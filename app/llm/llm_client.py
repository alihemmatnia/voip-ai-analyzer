import json
import logging
import re
from typing import Any, Dict, List
from openai import OpenAI
from core.config import settings

logger = logging.getLogger("VoIPAnalyzer")


REQUIRED_FIELDS = {
    "overall_health",
    "call_quality_score",
    "root_causes",
    "critical_findings",
    "detected_issues",
    "recommendations",
    "executive_summary",
}

LOG_REQUIRED_FIELDS = {
    "executive_summary",
    "overall_health",
    "root_causes",
    "incident_timeline",
    "affected_services",
    "health_scores",
    "critical_findings",
    "recommendations",
}


def analyze_voip_summary_with_ai(
    summary_json: Dict[str, Any]
) -> Dict[str, Any]:

    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL
    model = settings.OPENAI_MODEL

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    system_prompt = """
You are a Senior VoIP Engineer and Root Cause Analysis engine.

Analyze SIP, RTP, WebRTC, SBC, NAT, STUN/TURN, firewall, codec,
registration and media quality metrics.

IMPORTANT OUTPUT RULES:

- Return ONLY JSON.
- Do NOT return markdown.
- Do NOT return tables.
- Do NOT return explanations outside JSON.
- Response MUST be valid json.loads().
- Use empty arrays if no findings exist.

Required schema:

{
  "overall_health": "Good|Fair|Critical",
  "call_quality_score": 0,
  "root_causes": [],
  "critical_findings": [],
  "detected_issues": [],
  "recommendations": [],
  "executive_summary": ""
}
"""

    user_prompt = json.dumps(summary_json, indent=2)

    try:

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=0,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )

        content = (
            response.choices[0].message.content
            if response.choices
            else ""
        )
        if not content:
            raise ValueError("Empty LLM response")

        logger.info("LLM response received")

        result = parse_and_validate_json(content)
        return result

    except Exception as e:

        logger.warning(
            f"Primary JSON generation failed: {e}"
        )

        try:
            return repair_json_response(
                client=client,
                model=model,
                raw_content=locals().get("content", ""),
                required_fields=REQUIRED_FIELDS,
            )

        except Exception as repair_error:

            logger.error(
                f"Repair failed: {repair_error}"
            )

            return generate_local_ai_fallback_analysis(
                summary_json,
                str(repair_error),
            )


def analyze_voip_log_summary_with_ai(
    summary_json: Dict[str, Any]
) -> Dict[str, Any]:

    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL
    model = settings.OPENAI_MODEL

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    system_prompt = """
You are a Senior VoIP Troubleshooting Engineer.
Analyze the provided VoIP log summary and extract deep root causes, event correlations, service impacts, and timeline sequences.

IMPORTANT INSTRUCTION FOR CORRELATION:
Instead of reporting independent failures separately, correlate them.
For example, if you see an Authentication Failure followed by a Registration Failure, a SIP Trunk going Offline, and then Call Failures, correlate them into a single incident chain.

IMPORTANT RESPONSE RULES:
- Return ONLY JSON.
- Do NOT return markdown or tables.
- Return valid JSON that can be decoded with json.loads().
- Action plans must be highly detailed and split into immediate and long-term actions.

Target JSON Schema:
{
  "executive_summary": "High-level summary of the incident and general system state.",
  "overall_health": "Good|Warning|Critical",
  "root_causes": [
    {
      "issue": "SIP trunk authentication failure",
      "confidence": 92,
      "severity": "INFO|LOW|MEDIUM|HIGH|CRITICAL"
    }
  ],
  "incident_timeline": [
    "12:01:03 Registration Failed",
    "12:01:05 Authentication Error",
    "12:01:12 SIP Trunk Disconnected",
    "12:01:14 Call Failure",
    "12:01:15 Queue Service Impacted"
  ],
  "affected_services": [
    "Inbound Calls",
    "Call Recording",
    "Agent Registration",
    "Queue Processing",
    "IVR",
    "Outbound Calls"
  ],
  "health_scores": {
    "sip": 90,
    "media": 85,
    "carrier": 50,
    "database": 100
  },
  "critical_findings": [
    "Authentication failure for trunk provider",
    "RTP timeouts detected"
  ],
  "recommendations": {
    "immediate_actions": [
      "1. Verify SIP trunk credentials",
      "2. Check provider registration status",
      "3. Test OPTIONS ping",
      "4. Verify firewall rules"
    ],
    "long_term_actions": [
      "1. Enable trunk monitoring",
      "2. Configure failover carrier",
      "3. Add alerting rules"
    ]
  }
}
"""

    user_prompt = json.dumps(summary_json, indent=2)

    try:

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=0,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )

        content = (
            response.choices[0].message.content
            if response.choices
            else ""
        )
        if not content:
            raise ValueError("Empty LLM response")

        logger.info("LLM log analysis response received")

        result = parse_and_validate_json(content, required_fields=LOG_REQUIRED_FIELDS)
        return result

    except Exception as e:

        logger.warning(
            f"Primary JSON generation failed: {e}"
        )

        try:
            return repair_json_response(
                client=client,
                model=model,
                raw_content=locals().get("content", ""),
                required_fields=LOG_REQUIRED_FIELDS,
            )

        except Exception as repair_error:

            logger.error(
                f"Repair failed: {repair_error}"
            )

            return generate_local_log_ai_fallback_analysis(
                summary_json,
                str(repair_error),
            )


def parse_and_validate_json(content: str, required_fields: set[str] | None = None) -> Dict[str, Any]:

    cleaned = clean_response(content)

    data = json.loads(cleaned)

    fields = required_fields or REQUIRED_FIELDS
    missing = fields - set(data.keys())

    if missing:
        raise ValueError(
            f"Missing schema fields: {missing}"
        )

    return data


def clean_response(content: str) -> str:

    content = content.strip()

    content = re.sub(
        r"^```(?:json)?\s*",
        "",
        content,
        flags=re.IGNORECASE,
    )

    content = re.sub(
        r"\s*```$",
        "",
        content,
    )

    content = content.strip()

    if content.startswith("{"):
        return content

    match = re.search(
        r"\{.*\}",
        content,
        re.DOTALL,
    )

    if match:
        return match.group(0)

    raise ValueError(
        "No JSON object found in response"
    )


def repair_json_response(
    client: OpenAI,
    model: str,
    raw_content: str,
    required_fields: set[str] | None = None,
) -> Dict[str, Any]:

    if required_fields == LOG_REQUIRED_FIELDS:
        schema_text = """
{
  "executive_summary": "",
  "overall_health": "Good|Warning|Critical",
  "root_causes": [
    {
      "issue": "",
      "confidence": 0,
      "severity": "INFO|LOW|MEDIUM|HIGH|CRITICAL"
    }
  ],
  "incident_timeline": [],
  "affected_services": [],
  "health_scores": {
    "sip": 100,
    "media": 100,
    "carrier": 100,
    "database": 100
  },
  "critical_findings": [],
  "recommendations": {
    "immediate_actions": [],
    "long_term_actions": []
  }
}
"""
    else:
        schema_text = """
{
  "overall_health": "Good|Fair|Critical",
  "call_quality_score": 0,
  "root_causes": [],
  "critical_findings": [],
  "detected_issues": [],
  "recommendations": [],
  "executive_summary": ""
}
"""

    repair_prompt = f"""
Convert the following VoIP report into JSON.

Return ONLY JSON.

Required schema:

{schema_text}

REPORT:

{raw_content}
"""

    repair_response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "Return ONLY JSON.",
            },
            {
                "role": "user",
                "content": repair_prompt,
            },
        ],
        temperature=0,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )

    repaired_content = (
        repair_response.choices[0].message.content
        if repair_response.choices
        else ""
    )

    if not repaired_content:
        raise ValueError(
            "Repair model returned empty response"
        )

    return parse_and_validate_json(
        repaired_content,
        required_fields=required_fields,
    )


def generate_local_log_ai_fallback_analysis(
    summary_json: Dict[str, Any],
    raw_error: str,
) -> Dict[str, Any]:

    error_count = summary_json.get("error_count", 0)
    warning_count = summary_json.get("warning_count", 0)
    
    sip_health = max(100 - error_count * 5, 0)
    media_health = 100
    carrier_health = 100
    db_health = 100

    overall_health = "Good"
    if error_count > 30 or summary_json.get("network_errors", 0) > 5:
        overall_health = "Critical"
    elif error_count > 5 or warning_count > 20:
        overall_health = "Warning"

    root_causes = []
    critical_findings = []
    immediate_actions = []
    long_term_actions = []
    affected_services = []
    incident_timeline = []

    matched_lines = summary_json.get("matched_lines", [])
    critical_lines = [l for l in matched_lines if l.get("severity") in ("error", "warning")]
    if not critical_lines:
        critical_lines = matched_lines
        
    for line in critical_lines[:15]:
        ts = line.get("timestamp") or ""
        msg = line.get("message", "")
        if ts and msg.startswith(ts):
            msg_clean = msg
        else:
            msg_clean = f"{ts} {msg}" if ts else msg
        if len(msg_clean) > 75:
            msg_clean = msg_clean[:72] + "..."
        incident_timeline.append(msg_clean)

    if summary_json.get("authentication_failures", 0) > 0:
        sip_health = max(sip_health - 30, 0)
        root_causes.append({
            "issue": "SIP authentication failures causing registration outages",
            "confidence": 95,
            "severity": "CRITICAL"
        })
        critical_findings.append(
            f"{summary_json['authentication_failures']} authentication failure events detected"
        )
        affected_services.append("Agent Registration")
        affected_services.append("Outbound Calls")
        immediate_actions.extend([
            "Verify SIP trunk credentials and domain settings",
            "Verify PJSIP/Sofia gateway authentication configs"
        ])
        long_term_actions.append("Implement automated credential rotation and monitoring alerts")

    if summary_json.get("registration_failures", 0) > 0:
        sip_health = max(sip_health - 20, 0)
        if not any(rc["issue"].startswith("SIP authentication") for rc in root_causes):
            root_causes.append({
                "issue": "Repeated registration timeouts / failures",
                "confidence": 80,
                "severity": "HIGH"
            })
        critical_findings.append(
            f"{summary_json['registration_failures']} registration failure events observed"
        )
        if "Agent Registration" not in affected_services:
            affected_services.append("Agent Registration")
        immediate_actions.append("Check network reachability to the registrar proxy")
        long_term_actions.append("Tune registration timeouts and keep-alive intervals")

    if summary_json.get("rtp_errors", 0) > 0 or summary_json.get("codec_errors", 0) > 0:
        media_health = max(100 - summary_json.get("rtp_errors", 0) * 15 - summary_json.get("codec_errors", 0) * 10, 0)
        root_causes.append({
            "issue": "RTP media instability or codec mismatch",
            "confidence": 85,
            "severity": "HIGH" if media_health < 50 else "MEDIUM"
        })
        critical_findings.append(
            f"RTP timeout or codec negotiation warnings found"
        )
        affected_services.append("Call Quality")
        affected_services.append("Inbound Calls")
        immediate_actions.extend([
            "Check local and remote codec compatibility list (ensure G.711 / OPUS matches)",
            "Check media port mappings on firewalls/SBCs"
        ])
        long_term_actions.append("Configure dynamic codec payloads and verify STUN/TURN traversal configurations")

    if summary_json.get("network_errors", 0) > 0 or summary_json.get("trunk_errors", 0) > 0 or summary_json.get("gateway_errors", 0) > 0:
        carrier_health = max(100 - summary_json.get("trunk_errors", 0) * 40 - summary_json.get("gateway_errors", 0) * 20, 0)
        root_causes.append({
            "issue": "Trunk or gateway failure (network infrastructure error)",
            "confidence": 90,
            "severity": "CRITICAL" if carrier_health < 40 else "HIGH"
        })
        critical_findings.append(
            "SIP gateway or carrier trunk connectivity timeout"
        )
        affected_services.extend(["Inbound Calls", "Outbound Calls"])
        immediate_actions.extend([
            "Verify routing configuration and DNS settings for SIP trunk",
            "Send OPTIONS ping requests to SIP gateway to test reachability"
        ])
        long_term_actions.append("Configure a secondary backup carrier trunk for failover routing")

    if not root_causes:
        root_causes.append({
            "issue": "Unknown minor anomalies",
            "confidence": 50,
            "severity": "LOW"
        })

    if not critical_findings:
        critical_findings.append("No critical indicators detected.")

    if not immediate_actions:
        immediate_actions.append("Check device logs and run ping diagnostics.")

    if not long_term_actions:
        long_term_actions.append("Add alert dashboards for registration and call setups.")

    if not affected_services:
        affected_services.append("None")

    if not incident_timeline:
        incident_timeline.append("No incidents recorded in timeline.")

    return {
        "executive_summary": (
            f"Fallback log analysis generated (LLM did not respond). "
            f"Detected {error_count} errors and {warning_count} warnings on {summary_json.get('platform', 'Unknown')} platform."
        ),
        "overall_health": overall_health,
        "root_causes": root_causes,
        "incident_timeline": incident_timeline,
        "affected_services": affected_services,
        "health_scores": {
            "sip": sip_health,
            "media": media_health,
            "carrier": carrier_health,
            "database": db_health
        },
        "critical_findings": critical_findings,
        "recommendations": {
            "immediate_actions": immediate_actions,
            "long_term_actions": long_term_actions
        }
    }


def generate_local_ai_fallback_analysis(
    summary_json: Dict[str, Any],
    raw_error: str,
) -> Dict[str, Any]:

    score = summary_json.get(
        "call_quality_score",
        100,
    )

    if score >= 80:
        overall_health = "Good"
    elif score >= 50:
        overall_health = "Fair"
    else:
        overall_health = "Critical"

    root_causes = []
    findings = []
    recommendations = []

    nat = summary_json.get(
        "nat_issues",
        {},
    )

    sip_stats = summary_json.get(
        "sip_stats",
        {},
    )

    detected_issues = summary_json.get(
        "detected_issues",
        [],
    )

    if nat.get(
        "possible_nat_traversal_issues",
        False,
    ):
        root_causes.append(
            "NAT traversal mismatch"
        )

        findings.append(
            "Private/Public IP mismatch detected"
        )

        recommendations.append(
            "Configure STUN/TURN or SBC traversal policies"
        )

    if sip_stats.get(
        "authentication_failures",
        0,
    ) > 0:

        root_causes.append(
            "SIP authentication failures"
        )

        findings.append(
            f"{sip_stats['authentication_failures']} authentication failures detected"
        )

        recommendations.append(
            "Verify SIP credentials and realm settings"
        )

    if sip_stats.get(
        "failed_calls",
        0,
    ) > 0:

        root_causes.append(
            "Failed SIP call establishment"
        )

        findings.append(
            f"{sip_stats['failed_calls']} failed calls observed"
        )

        recommendations.append(
            "Review SIP proxy and carrier logs"
        )

    if (
        "Excessive jitter" in detected_issues
        or "Excessive packet loss" in detected_issues
    ):
        root_causes.append(
            "Network instability"
        )

        findings.append(
            "Jitter and packet loss affecting RTP quality"
        )

        recommendations.append(
            "Enable QoS and adaptive jitter buffers"
        )

    if not root_causes:
        root_causes.append(
            "No significant issues detected"
        )

    return {
        "overall_health": overall_health,
        "call_quality_score": score,
        "root_causes": root_causes,
        "critical_findings": findings,
        "detected_issues": detected_issues,
        "recommendations": recommendations,
        "executive_summary": (
            f"Analysis completed using fallback engine. "
            f"Call quality score is {score}/100. "
            f"LLM unavailable or returned invalid output. "
            f"Reason: {raw_error[:200]}"
        ),
    }


def answer_analysis_chat_message(
    chat_history: List[Dict[str, str]],  # [{"role": "user"|"assistant", "content": "..."}]
    analysis_context: Dict[str, Any],
    mode: str = "expert"  # beginner, intermediate, expert
) -> str:
    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL
    model = settings.OPENAI_MODEL

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    system_prompt = f"""
You are a Senior VoIP Troubleshooting Engineer with 15+ years of experience.
You are reviewing a completed VoIP analysis report.
Your job is to explain findings, justify conclusions, reference evidence, and guide troubleshooting.

Always use the provided analysis context to answer.
Never invent data or mention information not present in the analysis context.
If evidence or details are not available in the context:
Explicitly reply: "I cannot confirm this from the uploaded data."

For every response, you MUST provide:
1. Direct Answer
2. Supporting Evidence (citing specific metrics, timeline entries, logs, or results from the context)
3. Recommended Next Steps (specific troubleshooting checks, CLI commands, or configs)

Response Mode: {mode.upper()}
- BEGINNER: Simple, high-level explanation without technical jargon.
- INTERMEDIATE: Technical explanation with standard SIP/RTP terms.
- EXPERT: Deep, professional engineering level explanation detailing SIP headers, codes, RTP jitter, packet losses, etc.

Use a professional, helpful engineering tone.
Return response in Markdown format.
"""

    context_prompt = f"""
---
ANALYSIS CONTEXT PACKAGE:
{json.dumps(analysis_context, indent=2)}
---
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": context_prompt}
    ]

    for msg in chat_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=1500
        )
        content = response.choices[0].message.content if response.choices else ""
        reply = content.strip()
        
        # Clean up outer markdown code fencing block if returned by LLM
        if reply.startswith("```markdown"):
            reply = reply[11:].strip()
            if reply.endswith("```"):
                reply = reply[:-3].strip()
        elif reply.startswith("```"):
            reply = reply[3:].strip()
            if reply.endswith("```"):
                reply = reply[:-3].strip()
                
        return reply
    except Exception as e:
        logger.error(f"Error calling LLM for analysis chat: {e}")
        return f"Error: Unable to process request. (Detail: {str(e)})"


def generate_suggested_questions(
    result_json: Dict[str, Any],
    job_type: str
) -> List[str]:
    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL
    model = settings.OPENAI_MODEL

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    system_prompt = """
You are a VoIP engineer. Review the analysis summary and output 5 to 8 suggested troubleshooting questions that a user might want to ask about this report.
Return ONLY a JSON list of strings. Do not return markdown. Do not return any text other than the JSON list.
Example output:
[
  "What is the most likely root cause?",
  "Why is the media health score low?"
]
"""
    try:
        # Slice result_json serialization to keep prompt size reasonable
        truncated_json_str = json.dumps(result_json)[:4000]
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": truncated_json_str}
            ],
            temperature=0.5,
            max_tokens=300
        )
        content = response.choices[0].message.content if response.choices else ""
        content = content.strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        questions = json.loads(content)
        if isinstance(questions, list):
            return [str(q) for q in questions[:10]]
    except Exception as e:
        logger.warning(f"Failed to generate suggested questions via LLM: {e}")

    # Fallbacks
    if job_type == "pcap":
        return [
            "What is the most likely root cause?",
            "Why is the call quality score low?",
            "Explain the NAT issues detected.",
            "Which RTP stream had the highest packet loss?",
            "What should I investigate first to fix this call?"
        ]
    else:
        return [
            "What is the most likely root cause?",
            "Why is the media health score low?",
            "Explain the critical findings in this log.",
            "Which SIP response code caused most failures?",
            "What are the immediate recommended steps?"
        ]