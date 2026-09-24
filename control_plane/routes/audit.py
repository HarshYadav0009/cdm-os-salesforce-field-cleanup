"""
CDM-OS — API Routes: Audit Log

Read-only endpoints for browsing the immutable audit trail.
Used by the Governance UI compliance view.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from control_plane.database import get_db
from control_plane.models import AuditLog
from control_plane.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit"])


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
