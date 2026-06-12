import io
import wave
import struct
from typing import Optional, List
import logging

try:
    from scapy.all import rdpcap, IP, UDP, Raw, PcapReader
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

logger = logging.getLogger("VoIPAnalyzer")

# G.711 mu-law to linear PCM (16-bit) table
# Generated standard mu-law table
_ulaw_table = []
for _i in range(256):
    _i_inv = ~_i & 0xFF
    _sign = (_i_inv & 0x80) >> 7
    _exponent = (_i_inv & 0x70) >> 4
    _mantissa = _i_inv & 0x0F
    _sample = (_mantissa << 3) + 0x84
    _sample <<= _exponent
    _sample -= 0x84
    if _sign:
        _sample = -_sample
    _ulaw_table.append(min(max(_sample, -32768), 32767))

# G.711 A-law to linear PCM (16-bit) table
_alaw_table = []
for _i in range(256):
    _ix = _i ^ 0x55
    _sign = (_ix & 0x80) >> 7
    _exponent = (_ix & 0x70) >> 4
    _mantissa = _ix & 0x0F
    if _exponent == 0:
        _sample = (_mantissa << 4) + 8
    else:
        _sample = (_mantissa << 4) + 0x108
        _sample <<= (_exponent - 1)
    if _sign:
        _sample = -_sample
    _alaw_table.append(min(max(_sample, -32768), 32767))


def decode_ulaw(payload: bytes) -> bytes:
    pcm_samples = [_ulaw_table[b] for b in payload]
    return struct.pack(f"<{len(pcm_samples)}h", *pcm_samples)

def decode_alaw(payload: bytes) -> bytes:
    pcm_samples = [_alaw_table[b] for b in payload]
    return struct.pack(f"<{len(pcm_samples)}h", *pcm_samples)


def extract_audio_from_pcap(file_path: str, target_ssrc: str, codec: str = "PCMU") -> Optional[bytes]:
    """
    Extracts RTP payloads for a given SSRC, decodes them, and returns a WAV buffer in memory.
    target_ssrc: e.g. '0x4D2A91E1'
    codec: 'PCMU (G.711)' or 'PCMA (G.711)'
    """
    if not SCAPY_AVAILABLE:
        logger.error("Scapy not available. Cannot extract audio.")
        return None

    try:
        ssrc_int = int(target_ssrc, 16)
    except ValueError:
        logger.error(f"Invalid SSRC format: {target_ssrc}")
        return None

    raw_payloads: List[bytes] = []
    
    try:
        # Read PCAP sequentially to extract RTP payloads
        with PcapReader(file_path) as pcap_reader:
            for pkt in pcap_reader:
                if pkt.haslayer(UDP) and pkt.haslayer(Raw):
                    payload_bytes = pkt[Raw].load
                    # RTP Header check: version 2
                    if len(payload_bytes) >= 12 and (payload_bytes[0] & 0xC0) == 0x80:
                        pkt_ssrc = (payload_bytes[8] << 24) | (payload_bytes[9] << 16) | (payload_bytes[10] << 8) | payload_bytes[11]
                        if pkt_ssrc == ssrc_int:
                            # Standard 12-byte header, check for CSRC and extensions
                            csrc_count = payload_bytes[0] & 0x0F
                            header_len = 12 + (csrc_count * 4)
                            # Check extension bit
                            if (payload_bytes[0] & 0x10):
                                # Has extension header, need to parse its length
                                if len(payload_bytes) > header_len + 4:
                                    ext_len = (payload_bytes[header_len+2] << 8) | payload_bytes[header_len+3]
                                    header_len += 4 + (ext_len * 4)
                            
                            if len(payload_bytes) > header_len:
                                raw_payloads.append(payload_bytes[header_len:])
    except Exception as e:
        logger.error(f"Error reading PCAP for audio extraction: {e}")
        return None

    if not raw_payloads:
        logger.warning(f"No RTP packets found for SSRC {target_ssrc}")
        return None

    # Concatenate all RTP payloads
    full_audio_stream = b"".join(raw_payloads)

    # Decode payload
    if "PCMU" in codec or codec == "0":
        pcm_data = decode_ulaw(full_audio_stream)
    elif "PCMA" in codec or codec == "8":
        pcm_data = decode_alaw(full_audio_stream)
    else:
        logger.error(f"Unsupported codec for playback: {codec}")
        return None

    # Write to WAV buffer
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wav_file:
        wav_file.setnchannels(1) # Mono
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(8000) # G.711 is 8kHz
        wav_file.writeframes(pcm_data)
    
    return wav_io.getvalue()
