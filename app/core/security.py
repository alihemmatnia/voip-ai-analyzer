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

import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

def encrypt_file(input_path: str, output_path: str, chunk_size=64*1024):
    """Encrypts a file using AES-CTR streaming mode to avoid memory exhaustion."""
    try:
        import base64
        key = base64.urlsafe_b64decode(settings.ENCRYPTION_KEY)
        nonce = os.urandom(16)
        cipher = Cipher(algorithms.AES(key), modes.CTR(nonce), backend=default_backend())
        encryptor = cipher.encryptor()
        
        with open(input_path, 'rb') as f_in, open(output_path, 'wb') as f_out:
            f_out.write(nonce)
            while chunk := f_in.read(chunk_size):
                f_out.write(encryptor.update(chunk))
            f_out.write(encryptor.finalize())
        return True
    except Exception as e:
        logger.error(f"Failed to encrypt file {input_path}: {e}")
        return False

def decrypt_file(input_path: str, output_path: str, chunk_size=64*1024):
    """Decrypts a file using AES-CTR streaming mode."""
    try:
        import base64
        key = base64.urlsafe_b64decode(settings.ENCRYPTION_KEY)
        
        with open(input_path, 'rb') as f_in, open(output_path, 'wb') as f_out:
            nonce = f_in.read(16)
            if len(nonce) < 16:
                raise ValueError("File too small to contain nonce")
                
            cipher = Cipher(algorithms.AES(key), modes.CTR(nonce), backend=default_backend())
            decryptor = cipher.decryptor()
            
            while chunk := f_in.read(chunk_size):
                f_out.write(decryptor.update(chunk))
            f_out.write(decryptor.finalize())
        return True
    except Exception as e:
        logger.error(f"Failed to decrypt file {input_path}: {e}")
        return False
