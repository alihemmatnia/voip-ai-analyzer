import datetime
import uuid
from sqlalchemy import Column, String, DateTime, Integer
from db.database import Base
from models.encrypted_type import EncryptedString

class PBXServer(Base):
    __tablename__ = "pbx_servers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    ip_address = Column(String(50), nullable=False)
    port = Column(Integer, default=22)
    username = Column(String(100), nullable=False)
    password = Column(EncryptedString(255), nullable=True) # Or path to SSH key
    ssh_key = Column(EncryptedString(5000), nullable=True)
    platform = Column(String(50), nullable=False, default="Asterisk") # Asterisk, FreeSWITCH, Kamailio, etc
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
