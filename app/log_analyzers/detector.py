import re
from typing import Dict
from .patterns import PLATFORM_PATTERNS, DETECTION_PRIORITY


def detect_platform(log_text: str) -> str:
    normalized = log_text.lower()

    scores = {platform: 0 for platform in PLATFORM_PATTERNS.keys()}

    # Check high-fidelity patterns and count matches
    for platform, patterns in PLATFORM_PATTERNS.items():
        for pattern in patterns:
            matches = len(pattern.findall(log_text))
            scores[platform] += matches * 10

    # Add extra keyword weights for strong platform-specific indicators
    if "sofia" in normalized or "switch_core" in normalized or "mod_sofia" in normalized:
        scores["FreeSWITCH"] += 50
    if "pjsip" in normalized or "chan_pjsip" in normalized or "asterisk" in normalized:
        scores["Asterisk"] += 50
    if "kamailio" in normalized or "ksr_" in normalized:
        scores["Kamailio"] += 50
    if "opensips" in normalized:
        scores["OpenSIPS"] += 50
    if "session border controller" in normalized or "acsbc" in normalized:
        scores["SBC"] += 50

    if "sip trunk" in normalized or "carrier" in normalized:
        scores["SBC"] += 5

    # Determine highest scoring platform
    best_platform = "Unknown"
    highest_score = 0
    for platform, score in scores.items():
        if score > highest_score:
            highest_score = score
            best_platform = platform

    return best_platform
