"""
CDM-OS — Audit Logger Unit Tests
"""

import pytest
from uuid import uuid4
from control_plane.audit import _compute_hmac, verify_entry
from control_plane.models import AuditLog


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
