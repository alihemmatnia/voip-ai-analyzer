import re
from typing import Dict
from .patterns import PLATFORM_PATTERNS, DETECTION_PRIORITY


def detect_platform(log_text: str) -> str:
    normalized = log_text.lower()

    for platform in DETECTION_PRIORITY:
        patterns = PLATFORM_PATTERNS.get(platform, [])
        for pattern in patterns:
            if pattern.search(log_text):
                return platform

    # fallback checks for known signatures
    if "sip trunk" in normalized or "carrier" in normalized:
        return "SBC"
    if "authentication" in normalized and "failed" in normalized:
        if "asterisk" in normalized:
            return "Asterisk"
        if "freeswitch" in normalized:
            return "FreeSWITCH"

    return "Unknown"
