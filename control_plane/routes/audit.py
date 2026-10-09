"""
CDM-OS — API Routes: Audit Log

Endpoints for recording and browsing the immutable audit trail.
Used by the Governance UI compliance view.
"""

from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from control_plane.audit import record_event
from control_plane.database import get_db
from control_plane.models import AuditLog
from control_plane.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit"])


class FieldAnalysisUsage(BaseModel):
    total_records: int = Field(..., ge=0)
    populated_records: int = Field(..., ge=0)
    usage_percentage: float = Field(..., ge=0, le=100)
    zero_usage_candidate: bool


class FieldAnalysisReferences(BaseModel):
    reference_count: int = Field(..., ge=0)
    summary: str = Field(..., max_length=2000)


class FieldAnalysisAuditCreate(BaseModel):
    object_name: str = Field(..., min_length=1, max_length=255)
    field_name: str = Field(..., min_length=1, max_length=255)
    outcome: Literal["SUCCEEDED", "FAILED"]
    usage: Optional[FieldAnalysisUsage] = None
    references: Optional[FieldAnalysisReferences] = None
    error_message: Optional[str] = Field(None, max_length=1000)


@router.post("/field-analysis", response_model=AuditLogResponse, status_code=201)
def record_field_analysis(
    body: FieldAnalysisAuditCreate,
    db: Session = Depends(get_db),
):
    """Persist a signed audit event for a field analysis run."""
    entry = record_event(
        db,
        "FIELD_ANALYSIS",
        "field-cleanup-ui",
        body.model_dump(exclude_none=True),
    )
    db.commit()
    db.refresh(entry)
    return entry


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
