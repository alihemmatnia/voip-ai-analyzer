import os
import json
import re
import logging
from typing import Dict, Any
from openai import OpenAI
from core.config import settings

logger = logging.getLogger("VoIPAnalyzer")

def analyze_voip_summary_with_ai(summary_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends the compact structured VoIP summary to the LLM (OpenAI-compatible)
    and returns a structured root-cause analysis that conforms to the requested schema.
    """
    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL
    model = settings.OPENAI_MODEL

    system_prompt = (
        "You are a senior VoIP engineer with 15 years of experience in: "
        "Contact Centers, SIP, RTP, WebRTC, SBC, Asterisk, FreeSWITCH, Kamailio, and OpenSIPS.\n"
        "Analyze the VoIP traffic summary provided by the user. "
        "Identify probable root causes for call quality degrade, NAT/Firewall traversal mismatches, failed registrations, or RTP gaps.\n"
        "Return ONLY valid JSON that matches the exact structure specified below. "
        "Do NOT include any markdown code blocks, do NOT write ```json, do NOT output explanations before or after the JSON.\n\n"
        "Schema:\n"
        "{\n"
        "  \"overall_health\": \"Good/Fair/Critical\",\n"
        "  \"call_quality_score\": 0-100,\n"
        "  \"root_causes\": [\"List of identified root causes\"],\n"
        "  \"critical_findings\": [\"Crucial issues that must be addressed\"],\n"
        "  \"detected_issues\": [\"Any additional detected anomalies\"],\n"
        "  \"recommendations\": [\"Actionable, clear recommendations (e.g. adjust NAT helper, edit codec priorities)\"],\n"
        "  \"executive_summary\": \"A short executive description explaining why calls succeeded/failed, RTP degradation, potential NAT/firewall involvement, network congestion, or codec mismatches.\"\n"
        "}"
    )

    user_content = json.dumps(summary_json, indent=2)

    try:
        client = OpenAI(api_key=api_key, base_url=base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the VoIP traffic summary:\n\n{user_content}"}
            ],
            temperature=0.2,
            max_tokens=2048,
        )

        content = response.choices[0].message.content.strip() if response.choices else ""
        logger.info("LLM Raw Response received.")

        cleaned_content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.MULTILINE)
        cleaned_content = re.sub(r"\s*```$", "", cleaned_content, flags=re.MULTILINE)
        cleaned_content = cleaned_content.strip()

        result = json.loads(cleaned_content)
        return result

    except Exception as e:
        logger.error(f"LLM analysis failed: {e}. Generating automatic deterministic report fallback.")
        return generate_local_ai_fallback_analysis(summary_json, str(e))


def generate_local_ai_fallback_analysis(summary_json: Dict[str, Any], raw_error: str) -> Dict[str, Any]:
    """
    A smart local fallback logic in case the LLM endpoint is offline or credentials are bad.
    Ensures the user gets useful analysis based on rule engines, matching standard VoIP logic.
    """
    call_quality_score = summary_json.get("call_quality_score", 100)
    detected_issues = summary_json.get("detected_issues", [])
    
    overall_health = "Good"
    if call_quality_score < 50:
        overall_health = "Critical"
    elif call_quality_score < 80:
        overall_health = "Fair"

    root_causes = []
    critical_findings = []
    recommendations = []

    nat = summary_json.get("nat_issues", {})
    if nat.get("possible_nat_traversal_issues"):
        root_causes.append("NAT traversal traversal collision without STUN/TURN binding updates.")
        critical_findings.append("Private IP address listed in SIP Contact headers or dynamic RTP negotiation.")
        recommendations.append("Configure a Session Border Controller (SBC) with Far-End NAT Traversal or enable rport (RFC 3581).")
        recommendations.append("Ensure STUN/TURN servers are successfully reachable in the WebRTC client configuration.")

    sip_stats = summary_json.get("sip_stats", {})
    if sip_stats.get("authentication_failures", 0) > 0:
        root_causes.append("SIP Register or INVITE authentication credential mismatch.")
        critical_findings.append(f"Detected {sip_stats['authentication_failures']} authentication challenges (401 Unauthorized or 407 Proxy Authentication Required).")
        recommendations.append("Verify SIP client credentials (username, password, and realm) in the phone or PBX settings.")

    if sip_stats.get("failed_calls", 0) > 0:
        root_causes.append("Failed SIP setups resulting in response errors.")
        critical_findings.append(f"Recorded {sip_stats['failed_calls']} failed calls or SIP registration timeouts.")
        recommendations.append("Review carrier/SIP proxy router logs. Look specifically for client registration timeouts (408 Request Timeout).")

    if "One-way audio" in detected_issues:
        root_causes.append("One-way media streaming path likely blocked by a strict firewall or symmetric NAT.")
        critical_findings.append("Symmetric RTP stream missing. Audio is only streaming in a single direction.")
        recommendations.append("Ensure SIP ALG is disabled on intervening routers and firewalls.")
        recommendations.append("Verify symmetric RTP (`rtp_symmetric = yes` in Asterisk/FreeSWITCH) is active.")

    if "Excessive jitter" in detected_issues or "Excessive packet loss" in detected_issues:
        root_causes.append("Network congestion, bufferbloat, or wireless link signal degradation.")
        critical_findings.append(f"Detected media jitter above limit, or high packet loss rate ({summary_json.get('packet_loss_percent')}%).")
        recommendations.append("Implement Quality of Service (QoS / DiffServ DSCP EF 46) policies on routers to prioritize RTP.")
        recommendations.append("Adjust jitter buffer size on SIP endpoints (adaptive jitter buffer recommended).")

    if not root_causes:
        root_causes.append("No critical system anomalies detected in SIP or RTP traces.")
        recommendations.append("Network operating within normal VoIP limits. Monitor for periodic traffic spikes.")

    exec_summary = (
        f"VoIP stream analysis processed {summary_json.get('call_count')} call records. "
        f"Determined an overall voice health of '{overall_health}' with a Call Quality Score of {call_quality_score}/100. "
    )
    if "One-way audio" in detected_issues:
        exec_summary += "Issues indicate a severe media transmission issue (one-way audio), suggesting a firewall or routing problem. "
    elif call_quality_score < 80:
        exec_summary += "Call quality is degraded primarily by network jitter, packet transmission drops, or codec negotiations. "
    else:
        exec_summary += "All examined SIP traces, registrations, and RTP streams indicate clean setups and stable connections. "
        
    exec_summary += f"[Diagnostic Note: LLM client responded with an error, fallbacks auto-applied: {raw_error[:100]}]"

    return {
        "overall_health": overall_health,
        "call_quality_score": call_quality_score,
        "root_causes": root_causes,
        "critical_findings": critical_findings,
        "detected_issues": detected_issues,
        "recommendations": recommendations,
        "executive_summary": exec_summary
    }
