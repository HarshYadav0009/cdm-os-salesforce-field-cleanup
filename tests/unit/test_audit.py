"""
CDM-OS — Audit Logger Unit Tests
"""

import pytest
from uuid import uuid4
from control_plane.audit import _compute_hmac, verify_entry
from control_plane.models import AuditLog
from control_plane.routes.audit import AuditVerificationRequest, verify_audit_logs
from unittest.mock import MagicMock


def test_hmac_computation():
    payload = {"action": "delete_field", "field": "Test__c"}
    sig1 = _compute_hmac(payload)
    sig2 = _compute_hmac(payload)

    assert sig1 == sig2
    assert len(sig1) == 64  # SHA256 hex digest length


def test_verify_entry_valid():
    payload = {"event": "TEST", "value": 123}
    sig = _compute_hmac(payload)

    entry = AuditLog(
        id=uuid4(),
        event_type="TEST_EVENT",
        actor="test-agent",
        payload=payload,
        hmac_signature=sig
    )

    assert verify_entry(entry) is True


def test_verify_entry_tampered():
    payload = {"event": "TEST", "value": 123}
    sig = _compute_hmac(payload)

    entry = AuditLog(
        id=uuid4(),
        event_type="TEST_EVENT",
        actor="test-agent",
        payload={"event": "TEST", "value": 999},  # Tampered!
        hmac_signature=sig
    )

    assert verify_entry(entry) is False


def test_audit_verification_reports_each_requested_record():
    payload = {"action": "deprecate"}
    valid = AuditLog(id=uuid4(), payload=payload, hmac_signature=_compute_hmac(payload))
    invalid = AuditLog(id=uuid4(), payload={"action": "delete"}, hmac_signature=_compute_hmac(payload))
    missing = AuditLog(id=uuid4(), payload=payload, hmac_signature=None)
    absent_id = uuid4()
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [valid, invalid, missing]
    result = verify_audit_logs(AuditVerificationRequest(ids=[valid.id, invalid.id, missing.id, absent_id]), db)
    assert [entry["status"] for entry in result["results"]] == ["Verified", "Invalid", "Missing", "Not found"]
    assert result["scope"] == "Event payload only"
    assert all(set(entry) == {"id", "status"} for entry in result["results"])


def test_audit_verification_request_is_bounded():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        AuditVerificationRequest(ids=[])
    with pytest.raises(ValidationError):
        AuditVerificationRequest(ids=[uuid4() for _ in range(501)])
