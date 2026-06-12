from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.server import PBXServer
from schemas.server import PBXServerResponse, PBXServerCreate
from services.ssh_client import SSHClientService
from pydantic import BaseModel

router = APIRouter(prefix="/servers", tags=["servers"])

@router.get("/", response_model=List[PBXServerResponse])
def list_servers(db: Session = Depends(get_db)):
    return db.query(PBXServer).all()

@router.post("/", response_model=PBXServerResponse)
def add_server(server: PBXServerCreate, db: Session = Depends(get_db)):
    db_server = PBXServer(
        name=server.name,
        ip_address=server.ip_address,
        port=server.port,
        username=server.username,
        password=server.password,
        ssh_key=server.ssh_key,
        platform=server.platform
    )
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server

@router.delete("/{server_id}")
def delete_server(server_id: str, db: Session = Depends(get_db)):
    db_server = db.query(PBXServer).filter(PBXServer.id == server_id).first()
    if not db_server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    db.delete(db_server)
    db.commit()
    return {"message": "Server deleted"}

class CommandRequest(BaseModel):
    command: str

@router.post("/{server_id}/execute")
def execute_command(server_id: str, payload: CommandRequest, db: Session = Depends(get_db)):
    db_server = db.query(PBXServer).filter(PBXServer.id == server_id).first()
    if not db_server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    ssh_service = SSHClientService(
        host=db_server.ip_address,
        port=db_server.port,
        username=db_server.username,
        password=db_server.password,
        ssh_key=db_server.ssh_key
    )
    
    try:
        output = ssh_service.execute_command(payload.command)
        return {"output": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{server_id}/logs")
def fetch_logs(server_id: str, lines: int = 100, db: Session = Depends(get_db)):
    db_server = db.query(PBXServer).filter(PBXServer.id == server_id).first()
    if not db_server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    ssh_service = SSHClientService(
        host=db_server.ip_address,
        port=db_server.port,
        username=db_server.username,
        password=db_server.password,
        ssh_key=db_server.ssh_key
    )
    
    try:
        output = ssh_service.get_latest_logs(lines=lines, platform=db_server.platform)
        return {"logs": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
