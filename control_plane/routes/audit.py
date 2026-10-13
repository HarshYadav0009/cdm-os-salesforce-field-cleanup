"""
CDM-OS — API Routes: Audit Log

Endpoints for recording and browsing the immutable audit trail.
Used by the Governance UI compliance view.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from control_plane.database import get_db
from control_plane.models import AuditLog
from control_plane.schemas import AuditLogResponse
from control_plane.audit import verify_entry

router = APIRouter(prefix="/audit", tags=["Audit"])


class AuditVerificationRequest(BaseModel):
    ids: list[UUID] = Field(min_length=1, max_length=500)


@router.post("/verify")
def verify_audit_logs(body: AuditVerificationRequest, db: Session = Depends(get_db)):
    """Verify stored payload signatures without exposing the signing secret."""
    entries = db.query(AuditLog).filter(AuditLog.id.in_(body.ids)).all()
    by_id = {entry.id: entry for entry in entries}
    return {"results": [
        {"id": str(entry_id), "status": (
            "Not found" if entry_id not in by_id
            else "Missing" if not by_id[entry_id].hmac_signature
            else "Verified" if verify_entry(by_id[entry_id]) else "Invalid"
        )}
        for entry_id in dict.fromkeys(body.ids)
    ], "scope": "Event payload only"}


@router.get("", response_model=list[AuditLogResponse], include_in_schema=False)
@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    event_type: Optional[str] = Query(None),
    proposal_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Query audit log entries with optional filters."""
    query = db.query(AuditLog)

    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if proposal_id:
        query = query.filter(AuditLog.proposal_id == proposal_id)

    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
