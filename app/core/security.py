from cryptography.fernet import Fernet
import logging
from core.config import settings

logger = logging.getLogger("VoIPAnalyzer")

def get_fernet() -> Fernet:
    try:
        return Fernet(settings.ENCRYPTION_KEY.encode('utf-8'))
    except ValueError as e:
        logger.error(f"Invalid ENCRYPTION_KEY format. Must be 32 url-safe base64-encoded bytes: {e}")
        # Fallback to a volatile key to prevent total crash, but data will be lost on restart
        volatile_key = Fernet.generate_key()
        logger.warning(f"Using VOLATILE encryption key: {volatile_key.decode('utf-8')}")
        return Fernet(volatile_key)

# Global singleton
fernet_instance = get_fernet()

def encrypt_data(data: str) -> str:
    if data is None:
        return data
    return fernet_instance.encrypt(data.encode('utf-8')).decode('utf-8')

def decrypt_data(token: str) -> str:
    if token is None:
        return token
    try:
        return fernet_instance.decrypt(token.encode('utf-8')).decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to decrypt database field: {e}")
        return "<Decryption Failed>"
