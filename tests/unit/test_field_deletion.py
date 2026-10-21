"""
tests/unit/test_field_deletion.py

Unit tests for SalesforceFieldDeletionService.

What to validate:
- Validates __c suffix (rejects non-custom fields)
- Rejects managed package fields (namespace__Field__c)
- Creates a backup before deletion
- confirm_delete=False is rejected
- Successful mock deletion returns expected structure
"""

import pytest
from unittest.mock import patch, MagicMock

# Adjust sys.path so the service can be imported without running the full app
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../tool-gateway"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../tool-gateway/servers"))

from salesforce.deletion_service import SalesforceFieldDeletionService
from salesforce.client import SalesforceClient


@pytest.fixture
def mock_client():
    """SalesforceClient in mock mode — no real Salesforce connection."""
    return SalesforceClient(mock_mode=True)


@pytest.fixture
def deletion_service(mock_client):
    """DeletionService backed by a mock client."""
    return SalesforceFieldDeletionService(client=mock_client)


# ──────────────────────────────────────────────────────────────────────────────
# Test: __c suffix validation
# ──────────────────────────────────────────────────────────────────────────────

def test_rejects_non_custom_field(deletion_service):
    """delete_field must raise ValueError when field does NOT end in __c."""
    with pytest.raises(ValueError, match="not a custom field"):
        deletion_service.delete_field(
            object_name="Account",
            field_name="Industry",
            confirm_delete=True,
        )


def test_rejects_standard_field_name_without_c(deletion_service):
    """Standard field names (no __c suffix) must be rejected."""
    with pytest.raises(ValueError, match="not a custom field"):
        deletion_service.delete_field(
            object_name="Account",
            field_name="Name",
            confirm_delete=True,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Test: Managed package rejection
# ──────────────────────────────────────────────────────────────────────────────

def test_rejects_managed_package_field(deletion_service):
    """Managed package fields (namespace__Field__c) must be rejected."""
    with pytest.raises(ValueError, match="managed package"):
        deletion_service.delete_field(
            object_name="Account",
            field_name="appns__Custom_Field__c",
            confirm_delete=True,
        )


def test_rejects_managed_package_with_long_namespace(deletion_service):
    """Multi-segment managed package field should also be rejected."""
    with pytest.raises(ValueError, match="managed package"):
        deletion_service.delete_field(
            object_name="Account",
            field_name="SomePkg__SomeField__c",
            confirm_delete=True,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Test: confirm_delete gate
# ──────────────────────────────────────────────────────────────────────────────

def test_rejects_when_confirm_delete_is_false(deletion_service):
    """confirm_delete=False must always be rejected, regardless of field validity."""
    with pytest.raises(RuntimeError, match="confirm_delete must be True"):
        deletion_service.delete_field(
            object_name="Account",
            field_name="Legacy_Cleanup_Test__c",
            confirm_delete=False,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Test: Backup is created before deletion
# ──────────────────────────────────────────────────────────────────────────────

def test_backup_created_before_deletion(deletion_service):
    """A backup must be created before the field is deleted."""
    backup_ids_created = []

    original_backup = deletion_service.backup_service.backup_field_definition

    def capturing_backup(object_name, field_name):
        result = original_backup(object_name, field_name)
        backup_ids_created.append(result["backup_id"])
        return result

    deletion_service.backup_service.backup_field_definition = capturing_backup

    result = deletion_service.delete_field(
        object_name="Account",
        field_name="Legacy_Cleanup_Test__c",
        confirm_delete=True,
        reason="Zero usage, safe to delete",
    )

    # Exactly one backup must have been created
    assert len(backup_ids_created) == 1
    # The backup_id in the result must match what was created
    assert result["backup_id"] == backup_ids_created[0]
    assert result["backup_id"].startswith("bak_")


# ──────────────────────────────────────────────────────────────────────────────
# Test: Successful deletion returns correct structure
# ──────────────────────────────────────────────────────────────────────────────

def test_successful_deletion_returns_expected_structure(deletion_service):
    """Successful deletion must return status=DELETED with object, field, and backup_id."""
    result = deletion_service.delete_field(
        object_name="Account",
        field_name="Legacy_Cleanup_Test__c",
        confirm_delete=True,
        reason="Unused field cleanup",
    )

    assert result["status"] == "DELETED"
    assert result["object"] == "Account"
    assert result["field"] == "Legacy_Cleanup_Test__c"
    assert "backup_id" in result
    assert result["backup_id"].startswith("bak_")
    assert "timestamp" in result


def test_deletion_removes_field_from_mock(deletion_service, mock_client):
    """After deletion in mock mode, the field should no longer be in the mock object."""
    # Verify field exists before deletion
    obj_before = mock_client._mock_objects.get("Account", {})
    field_names_before = [f["name"] for f in obj_before.get("fields", [])]
    assert "Legacy_Notes__c" in field_names_before, "Legacy_Notes__c should be in mock before deletion"

    deletion_service.delete_field(
        object_name="Account",
        field_name="Legacy_Notes__c",
        confirm_delete=True,
        reason="Test cleanup",
    )

    obj_after = mock_client._mock_objects.get("Account", {})
    field_names_after = [f["name"] for f in obj_after.get("fields", [])]
    assert "Legacy_Notes__c" not in field_names_after, "Legacy_Notes__c should be removed after deletion"
