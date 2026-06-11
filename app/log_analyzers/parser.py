import os
import json
import re
import logging
from collections import Counter
from typing import Dict, Any, List
from .detector import detect_platform
from .patterns import (
    SEVERITY_PATTERNS,
    SIP_ERROR_PATTERNS,
    PATTERN_GROUPS,
    SIP_ERROR_CODES,
)

logger = logging.getLogger("VoIPAnalyzer")


def parse_log_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Log file {file_path} does not exist.")

    with open(file_path, "r", encoding="utf-8", errors="ignore") as log_file:
        raw_text = log_file.read()

    platform = detect_platform(raw_text)
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    severity_rules = SEVERITY_PATTERNS.get(platform, SEVERITY_PATTERNS["Unknown"])

    error_count = 0
    warning_count = 0
    sip_errors = Counter()
    category_counts = {key: 0 for key in PATTERN_GROUPS.keys()}
    event_counter = Counter()
    detected_flags: List[str] = []

    for line in lines:
        if severity_rules["error"].search(line):
            error_count += 1
        if severity_rules["warning"].search(line):
            warning_count += 1

        for code, pattern in SIP_ERROR_PATTERNS.items():
            if pattern.search(line):
                sip_errors[code] += 1
                event_counter[f"SIP {code}"] += 1

        for category, patterns in PATTERN_GROUPS.items():
            for pattern in patterns:
                if pattern.search(line):
                    category_counts[category] += 1
                    event_counter[category] += 1
                    break

    for code in SIP_ERROR_CODES:
        if sip_errors.get(code, 0) > 0:
            continue

    top_errors = [error for error, _ in event_counter.most_common(5)]

    if category_counts["registration_failures"] > 20:
        detected_flags.append("Registration storms")
    if category_counts["authentication_failures"] > 20:
        detected_flags.append("Authentication attacks")
    if category_counts["rtp_warnings"] > 0:
        detected_flags.append("RTP instability")
    if category_counts["trunk_errors"] > 0:
        detected_flags.append("SIP trunk outage")
    if category_counts["gateway_errors"] > 0:
        detected_flags.append("Gateway connectivity issues")
    if category_counts["network_errors"] > 0:
        detected_flags.append("Network infrastructure problems")
    if category_counts["codec_errors"] > 0:
        detected_flags.append("Codec negotiation failures")
    if category_counts["timeouts"] > 0:
        detected_flags.append("Timeout events")

    summary = {
        "platform": platform,
        "error_count": error_count,
        "warning_count": warning_count,
        "registration_failures": category_counts["registration_failures"],
        "authentication_failures": category_counts["authentication_failures"],
        "network_errors": category_counts["network_errors"],
        "rtp_errors": category_counts["rtp_warnings"],
        "codec_errors": category_counts["codec_errors"],
        "gateway_errors": category_counts["gateway_errors"],
        "trunk_errors": category_counts["trunk_errors"],
        "call_failures": category_counts["call_failures"],
        "timeouts": category_counts["timeouts"],
        "sip_errors": {code: sip_errors.get(code, 0) for code in SIP_ERROR_CODES},
        "top_errors": top_errors,
        "line_count": len(lines),
        "detected_issues": detected_flags,
    }

    if category_counts["network_errors"] > 0 and "DNS" in raw_text.upper():
        summary["detected_issues"].append("DNS failures")
    if "NAT" in raw_text.upper() or "network address translation" in raw_text.lower():
        summary["detected_issues"].append("NAT-related problems")
    if not summary["detected_issues"]:
        summary["detected_issues"] = ["No major events detected"]

    return summary
