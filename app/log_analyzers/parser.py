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

# Regex for common date/time formats
ISO_PATTERN = re.compile(r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[,\.]\d{3,6})?(?:[\+\-]\d{2}:?\d{2}|Z)?)")
AST_PATTERN = re.compile(r"\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]")
SYSLOG_PATTERN = re.compile(r"([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})")
ALT_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})")

def extract_timestamp(line: str) -> str | None:
    prefix = line[:50]
    m = ISO_PATTERN.search(prefix)
    if m:
        return m.group(1)
    m = AST_PATTERN.search(prefix)
    if m:
        return m.group(1)
    m = SYSLOG_PATTERN.search(prefix)
    if m:
        return m.group(1)
    m = ALT_PATTERN.search(prefix)
    if m:
        return m.group(1)
    return None


def timestamp_to_ms(ts_str: str) -> int | None:
    m = re.search(r"(\d{2}):(\d{2}):(\d{2})[,\.]?(\d{3,6})?", ts_str)
    if m:
        hh, mm, ss = int(m.group(1)), int(m.group(2)), int(m.group(3))
        ms = int(m.group(4)[:3]) if m.group(4) else 0
        return ((hh * 3600) + (mm * 60) + ss) * 1000 + ms
    return None


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
    matched_lines = []

    # Compile call flow patterns
    inbound_req_pat = re.compile(
        r"inbound\s+([A-Z]+)\s+received\s+from\s+['\"]([^'\"]+)['\"](?:\s+to\s+['\"]([^'\"]+)['\"])?",
        re.IGNORECASE
    )
    outbound_req_pat = re.compile(
        r"outbound\s+([A-Z]+)\s+initiated\s+to\s+[^'\"]*['\"]([^'\"]+)['\"]",
        re.IGNORECASE
    )
    sip_send_resp_pat = re.compile(
        r"sending\s+sip/2\.0\s+(\d+\s+[A-Za-z ]+)",
        re.IGNORECASE
    )
    sip_code_pat = re.compile(
        r"response\s+code=(\d+)",
        re.IGNORECASE
    )
    generic_sip_pat = re.compile(
        r"(?:received|sent|transmitting)\s+(?:sip\s+)?(?:request|response)?[:]?\s*(sip/2\.0\s+\d+|[A-Z]+\b)",
        re.IGNORECASE
    )

    call_flow_ladder = []
    first_ts = None

    for idx, line in enumerate(lines):
        line_num = idx + 1
        line_severity = "info"
        matched_categories = []

        if severity_rules["error"].search(line):
            error_count += 1
            line_severity = "error"
        elif severity_rules["warning"].search(line):
            warning_count += 1
            line_severity = "warning"

        for code, pattern in SIP_ERROR_PATTERNS.items():
            if pattern.search(line):
                sip_errors[code] += 1
                event_counter[f"SIP {code}"] += 1
                matched_categories.append(f"SIP {code}")

        for category, patterns in PATTERN_GROUPS.items():
            for pattern in patterns:
                if pattern.search(line):
                    category_counts[category] += 1
                    event_counter[category] += 1
                    matched_categories.append(category)
                    break

        # Reconstruct Call Flow time
        ts = extract_timestamp(line)
        relative_ms = idx * 100
        if ts:
            t_ms = timestamp_to_ms(ts)
            if t_ms is not None:
                if first_ts is None:
                    first_ts = t_ms
                relative_ms = t_ms - first_ts
                if relative_ms < 0:
                    relative_ms = 0

        # Match signaling events
        m_in = inbound_req_pat.search(line)
        m_out = outbound_req_pat.search(line)
        m_resp = sip_send_resp_pat.search(line)
        m_code = sip_code_pat.search(line)
        m_gen = generic_sip_pat.search(line)

        event = None
        if m_in:
            method = m_in.group(1).upper()
            src = m_in.group(2)
            dst = m_in.group(3) or "LocalSystem"
            if src.startswith("sip:"):
                src = src[4:].split("@")[0]
            if dst.startswith("sip:"):
                dst = dst[4:].split("@")[0]
            event = {
                "time_ms": relative_ms,
                "source": src,
                "destination": dst,
                "info": method
            }
        elif m_out:
            method = m_out.group(1).upper()
            src = "LocalSystem"
            dst = m_out.group(2)
            if dst.startswith("sip:"):
                dst = dst[4:].split("@")[0]
            event = {
                "time_ms": relative_ms,
                "source": src,
                "destination": dst,
                "info": method
            }
        elif m_resp:
            resp_info = m_resp.group(1).upper()
            event = {
                "time_ms": relative_ms,
                "source": "LocalSystem",
                "destination": "Client",
                "info": resp_info
            }
        elif m_code:
            code_num = m_code.group(1)
            code_descr = "Response"
            if code_num == "401":
                code_descr = "401 Unauthorized"
            elif code_num == "200":
                code_descr = "200 OK"
            elif code_num == "403":
                code_descr = "403 Forbidden"
            elif code_num == "488":
                code_descr = "488 Not Acceptable Here"
            else:
                code_descr = f"{code_num} Response"
            event = {
                "time_ms": relative_ms,
                "source": "LocalSystem",
                "destination": "Client",
                "info": code_descr
            }
        elif m_gen:
            info_val = m_gen.group(1).upper()
            is_sent = "sent" in line.lower() or "transmitting" in line.lower()
            if is_sent:
                src, dst = "LocalSystem", "Remote"
            else:
                src, dst = "Remote", "LocalSystem"
            event = {
                "time_ms": relative_ms,
                "source": src,
                "destination": dst,
                "info": info_val
            }
        elif "registration expired" in line.lower():
            endpt_match = re.search(r"endpoint\s+'([^']+)'", line, re.IGNORECASE)
            endpt = endpt_match.group(1) if endpt_match else "Client"
            event = {
                "time_ms": relative_ms,
                "source": endpt,
                "destination": "LocalSystem",
                "info": "REGISTER EXPIRED"
            }

        if event:
            call_flow_ladder.append(event)

        if len(matched_lines) < 1000:
            ts = extract_timestamp(line)
            matched_lines.append({
                "line_number": line_num,
                "timestamp": ts,
                "severity": line_severity,
                "categories": matched_categories,
                "message": line
            })

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
        "matched_lines": matched_lines,
        "call_flow_ladder": call_flow_ladder,
    }

    if category_counts["network_errors"] > 0 and "DNS" in raw_text.upper():
        summary["detected_issues"].append("DNS failures")
    if "NAT" in raw_text.upper() or "network address translation" in raw_text.lower():
        summary["detected_issues"].append("NAT-related problems")
    if not summary["detected_issues"]:
        summary["detected_issues"] = ["No major events detected"]

    return summary

