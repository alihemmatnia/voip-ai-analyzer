import re
from typing import Pattern, Dict, List

SIP_ERROR_CODES = ["401", "403", "404", "408", "480", "486", "487", "500", "503"]

PLATFORM_PATTERNS = {
    "Asterisk": [
        re.compile(r"\b(WARNING|ERROR|NOTICE|VERBOSE|DEBUG)\[\d+\]", re.IGNORECASE),
        re.compile(r"chan_(pjsip|sip)|res_pjsip", re.IGNORECASE),
        re.compile(r"asterisk", re.IGNORECASE),
    ],
    "FreeSWITCH": [
        re.compile(r"freeswitch", re.IGNORECASE),
        re.compile(r"\[(ERR|CRIT|WARNING|DEBUG|INFO)\]\s+\S+\.c:\d+", re.IGNORECASE),
        re.compile(r"\bsofia(?:_glue|_presence)?\.c\b|\bswitch_core_\S+", re.IGNORECASE),
    ],
    "Kamailio": [
        re.compile(r"kamailio", re.IGNORECASE),
        re.compile(r"\bKSR\b|\bksr_\S+", re.IGNORECASE),
        re.compile(r"server\s+id", re.IGNORECASE),
    ],
    "OpenSIPS": [
        re.compile(r"opensips", re.IGNORECASE),
        re.compile(r"openser", re.IGNORECASE),
    ],
    "SBC": [
        re.compile(r"session border controller", re.IGNORECASE),
        re.compile(r"\bSBC\b", re.IGNORECASE),
    ],
}

SEVERITY_PATTERNS: Dict[str, Dict[str, Pattern[str]]] = {
    "Asterisk": {
        "error": re.compile(r"\[ERROR\]|\bERROR\b", re.IGNORECASE),
        "warning": re.compile(r"\[WARNING\]|\bWARNING\b", re.IGNORECASE),
    },
    "FreeSWITCH": {
        "error": re.compile(r"\b(ERR|CRIT|ERROR)\b", re.IGNORECASE),
        "warning": re.compile(r"\bWARNING\b", re.IGNORECASE),
    },
    "Kamailio": {
        "error": re.compile(r"\b(ERROR|ALERT|CRITICAL)\b", re.IGNORECASE),
        "warning": re.compile(r"\bWARNING\b", re.IGNORECASE),
    },
    "OpenSIPS": {
        "error": re.compile(r"\b(ERROR|CRITICAL)\b", re.IGNORECASE),
        "warning": re.compile(r"\bWARNING\b", re.IGNORECASE),
    },
    "SBC": {
        "error": re.compile(r"\b(ERROR|FAIL|CRITICAL|ALERT)\b", re.IGNORECASE),
        "warning": re.compile(r"\bWARNING\b", re.IGNORECASE),
    },
    "Unknown": {
        "error": re.compile(r"\b(ERROR|FAIL|CRITICAL|ALERT)\b", re.IGNORECASE),
        "warning": re.compile(r"\bWARNING\b|\bNOTICE\b", re.IGNORECASE),
    },
}

PATTERN_GROUPS = {
    "registration_failures": [
        re.compile(r"registration (expired|failed|timeout|unable|rejected)", re.IGNORECASE),
        re.compile(r"authentication failed", re.IGNORECASE),
        re.compile(r"invalid credentials", re.IGNORECASE),
        re.compile(r"endpoint unreachable", re.IGNORECASE),
        re.compile(r"register.*failed", re.IGNORECASE),
        re.compile(r"failed to register", re.IGNORECASE),
    ],
    "authentication_failures": [
        re.compile(r"authentication failed", re.IGNORECASE),
        re.compile(r"invalid credentials", re.IGNORECASE),
        re.compile(r"401 unauthorized", re.IGNORECASE),
        re.compile(r"403 forbidden", re.IGNORECASE),
        re.compile(r"digest authentication", re.IGNORECASE),
        re.compile(r"challenge.*401", re.IGNORECASE),
    ],
    "network_errors": [
        re.compile(r"dns resolution failure", re.IGNORECASE),
        re.compile(r"database connection failure", re.IGNORECASE),
        re.compile(r"network timeout", re.IGNORECASE),
        re.compile(r"connection timed out", re.IGNORECASE),
        re.compile(r"host unreachable", re.IGNORECASE),
        re.compile(r"no response from", re.IGNORECASE),
        re.compile(r"destination unreachable", re.IGNORECASE),
        re.compile(r"socket error", re.IGNORECASE),
        re.compile(r"transport error", re.IGNORECASE),
    ],
    "rtp_warnings": [
        re.compile(r"rtp timeout", re.IGNORECASE),
        re.compile(r"no audio", re.IGNORECASE),
        re.compile(r"one way audio", re.IGNORECASE),
        re.compile(r"media negotiation failed", re.IGNORECASE),
        re.compile(r"codec mismatch", re.IGNORECASE),
        re.compile(r"rtp.*loss", re.IGNORECASE),
        re.compile(r"rtp.*retransmit", re.IGNORECASE),
    ],
    "codec_errors": [
        re.compile(r"codec mismatch", re.IGNORECASE),
        re.compile(r"unsupported codec", re.IGNORECASE),
        re.compile(r"codec negotiation failed", re.IGNORECASE),
        re.compile(r"payload type .* not supported", re.IGNORECASE),
    ],
    "gateway_errors": [
        re.compile(r"gateway (down|unavailable|failed|error)", re.IGNORECASE),
        re.compile(r"sip trunk unavailable", re.IGNORECASE),
    ],
    "trunk_errors": [
        re.compile(r"sip trunk unavailable", re.IGNORECASE),
        re.compile(r"trunk (failed|down|unavailable|error)", re.IGNORECASE),
        re.compile(r"carrier.*failure", re.IGNORECASE),
    ],
    "call_failures": [
        re.compile(r"call failed", re.IGNORECASE),
        re.compile(r"failed to place call", re.IGNORECASE),
        re.compile(r"call setup failed", re.IGNORECASE),
        re.compile(r"session terminated", re.IGNORECASE),
        re.compile(r"hangup cause", re.IGNORECASE),
    ],
    "timeouts": [
        re.compile(r"request timeout", re.IGNORECASE),
        re.compile(r"timed out", re.IGNORECASE),
        re.compile(r"timeout", re.IGNORECASE),
    ],
}

SIP_ERROR_PATTERNS = {
    code: re.compile(
        rf"\b(?:SIP/2\.0\s+{code}|{code}\b|code={code}|sip_code={code})\b",
        re.IGNORECASE,
    )
    for code in SIP_ERROR_CODES
}

DETECTION_PRIORITY = ["Asterisk", "FreeSWITCH", "Kamailio", "OpenSIPS", "SBC"]

def get_platform_detector_patterns() -> List[tuple[str, List[Pattern[str]]]]:
    return list(PLATFORM_PATTERNS.items())
