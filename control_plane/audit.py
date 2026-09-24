"""
CDM-OS — Audit Logger

Writes HMAC-signed audit log entries to the database.
Every significant action in the system (proposal created, policy check,
human decision, tool execution) must be recorded via this module.
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from control_plane.config import settings
from control_plane.models import AuditLog


def _compute_hmac(payload: dict) -> str:
    """Compute HMAC-SHA256 signature over the JSON-serialized payload."""
    payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hmac.new(
        settings.AUDIT_HMAC_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()


def record_event(
    db: Session,
    event_type: str,
    actor: str,
    payload: dict,
    proposal_id: Optional[UUID] = None,
) -> AuditLog:
    """
    Record an immutable, HMAC-signed audit log entry.

    Args:
        db: Active database session
        event_type: e.g. PROPOSAL_CREATED, POLICY_CHECK, HUMAN_DECISION, TOOL_EXECUTED
        actor: agent_id, user email, or 'system'
        payload: Arbitrary JSON data describing the event
        proposal_id: Optional link to the proposal this event relates to

    Returns:
        The created AuditLog record
    """
    signature = _compute_hmac(payload)

    entry = AuditLog(
        event_type=event_type,
        actor=actor,
        proposal_id=proposal_id,
        payload=payload,
        hmac_signature=signature,
    )
    db.add(entry)
    db.flush()  # Assign ID without committing (caller controls transaction)
    return entry


def verify_entry(entry: AuditLog) -> bool:
    """Verify that an audit log entry has not been tampered with."""
    expected = _compute_hmac(entry.payload)
    return hmac.compare_digest(expected, entry.hmac_signature or "")
