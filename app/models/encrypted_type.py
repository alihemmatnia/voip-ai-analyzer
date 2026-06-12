import sqlalchemy.types as types
from core.security import encrypt_data, decrypt_data

class EncryptedString(types.TypeDecorator):
    """
    Transparently encrypts data before saving to DB and decrypts it when retrieving.
    Stores the result as a standard SQLAlchemy String.
    """
    
    impl = types.String
    cache_ok = True

    def __init__(self, length=None, *args, **kwargs):
        super().__init__(length=length, *args, **kwargs)

    def process_bind_param(self, value, dialect):
        # Triggered when saving to the database
        if value is not None:
            return encrypt_data(value)
        return value

    def process_result_value(self, value, dialect):
        # Triggered when loading from the database
        if value is not None:
            return decrypt_data(value)
        return value
