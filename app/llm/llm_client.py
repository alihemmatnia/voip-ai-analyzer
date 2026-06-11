import json
import logging
import re
from typing import Any, Dict
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
            )

        except Exception as repair_error:

            logger.error(
                f"Repair failed: {repair_error}"
            )

            return generate_local_ai_fallback_analysis(
                summary_json,
                str(repair_error),
            )


def parse_and_validate_json(content: str) -> Dict[str, Any]:

    cleaned = clean_response(content)

    data = json.loads(cleaned)

    missing = REQUIRED_FIELDS - set(data.keys())

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
) -> Dict[str, Any]:

    repair_prompt = f"""
Convert the following VoIP report into JSON.

Return ONLY JSON.

Required schema:

{{
  "overall_health": "Good|Fair|Critical",
  "call_quality_score": 0,
  "root_causes": [],
  "critical_findings": [],
  "detected_issues": [],
  "recommendations": [],
  "executive_summary": ""
}}

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
        repaired_content
    )


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