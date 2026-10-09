from types import SimpleNamespace

import pytest

from servers.salesforce.client import SalesforceClient
from servers.salesforce.deletion_service import SalesforceFieldDeletionService
from servers.salesforce.validators import validate_tool_payload


class BackupStub:
    def __init__(self):
        self.calls = []

    def backup_field_definition(self, object_name, field_name):
        self.calls.append((object_name, field_name))
        return {"backup_id": "backup-test-id"}


def test_delete_custom_field_requires_explicit_confirmation():
    client = SalesforceClient(mock_mode=True)
    backup = BackupStub()
    service = SalesforceFieldDeletionService(client, backup)

    with pytest.raises(ValueError, match="Explicit confirmation"):
        service.delete_field("Account", "Legacy_Cleanup_Test__c", False)

    assert backup.calls == []


def test_delete_custom_field_creates_backup_before_deleting():
    client = SalesforceClient(mock_mode=True)
    backup = BackupStub()
    service = SalesforceFieldDeletionService(client, backup)
    original_delete = client.delete_custom_field

    def assert_backed_up_then_delete(object_name, field_name):
        assert backup.calls == [(object_name, field_name)]
        original_delete(object_name, field_name)

    client.delete_custom_field = assert_backed_up_then_delete

    result = service.delete_field(
        "Account",
        "Legacy_Cleanup_Test__c",
        True,
        "Approved cleanup",
    )

    assert result["status"] == "DELETED"
    assert result["backup_id"] == "backup-test-id"
    assert "metadata only" in result["warning"]
    remaining_fields = client.describe("Account")["fields"]
    assert all(
        field["name"] != "Legacy_Cleanup_Test__c" for field in remaining_fields
    )


def test_delete_field_rejects_standard_and_managed_fields():
    client = SalesforceClient(mock_mode=True)
    service = SalesforceFieldDeletionService(client, BackupStub())

    with pytest.raises(ValueError, match="Only custom"):
        service.delete_field("Account", "Name", True)

    with pytest.raises(ValueError, match="Managed-package"):
        service.delete_field("Account", "vendor__Legacy_Field__c", True)


def test_delete_field_client_passes_metadata_full_names_as_strings():
    calls = []
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = SimpleNamespace(
        mdapi=SimpleNamespace(
            CustomField=SimpleNamespace(
                delete=lambda components: calls.append(components),
            )
        )
    )

    client.delete_custom_field("Account", "Legacy_Cleanup_Test__c")

    assert calls == [["Account.Legacy_Cleanup_Test__c"]]


def test_delete_field_payload_requires_confirmation():
    with pytest.raises(ValueError, match="confirm_delete"):
        validate_tool_payload(
            "salesforce_delete_field",
            {
                "object_name": "Account",
                "field_name": "Legacy_Cleanup_Test__c",
            },
        )
