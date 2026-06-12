from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PBXServerBase(BaseModel):
    name: str
    ip_address: str
    port: Optional[int] = 22
    username: str
    platform: Optional[str] = "Asterisk"

class PBXServerCreate(PBXServerBase):
    password: Optional[str] = None
    ssh_key: Optional[str] = None

class PBXServerResponse(PBXServerBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
