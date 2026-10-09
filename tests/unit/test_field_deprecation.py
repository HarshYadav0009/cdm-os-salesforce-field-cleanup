from servers.salesforce.client import SalesforceClient
from servers.salesforce.deprecation_service import SalesforceFieldDeprecationService


class BackupStub:
    def __init__(self):
        self.backup_calls = []
        self.rollback_calls = []

    def backup_field_definition(self, object_name, field_name):
        self.backup_calls.append((object_name, field_name))
        return {"backup_id": "backup-test-id"}

    def rollback_field(self, backup_id):
        self.rollback_calls.append(backup_id)
        return {"description_restored": True}


def test_deprecation_marks_description_and_leaves_fls_unchanged():
    client = SalesforceClient(mock_mode=True)
    backup = BackupStub()
    client._mock_fls_records["Account.Legacy_Cleanup_Test__c"] = {
        "readable": True,
        "editable": True,
    }
    service = SalesforceFieldDeprecationService(client, backup)

    result = service.deprecate_field(
        "Account",
        "Legacy_Cleanup_Test__c",
        "No longer used",
    )

    field = next(
        item
        for item in client.describe("Account")["fields"]
        if item["name"] == "Legacy_Cleanup_Test__c"
    )
    assert result["status"] == "DEPRECATED"
    assert result["fls_restricted"] is False
    assert "left unchanged" in result["warning"]
    assert field["description"].startswith("[DEPRECATED:")
    assert client._mock_fls_records["Account.Legacy_Cleanup_Test__c"] == {
        "readable": True,
        "editable": True,
    }
    assert backup.backup_calls == [("Account", "Legacy_Cleanup_Test__c")]


def test_deprecation_failure_restores_original_description():
    client = SalesforceClient(mock_mode=True)
    backup = BackupStub()
    original_description = next(
        item["description"]
        for item in client.describe("Account")["fields"]
        if item["name"] == "Legacy_Cleanup_Test__c"
    )
    service = SalesforceFieldDeprecationService(client, backup)

    try:
        service.deprecate_field(
            "Account",
            "Legacy_Cleanup_Test__c",
            simulate_error=True,
        )
    except RuntimeError as exc:
        assert "Original description restored" in str(exc)
    else:
        raise AssertionError("Expected simulated deprecation failure")

    field = next(
        item
        for item in client.describe("Account")["fields"]
        if item["name"] == "Legacy_Cleanup_Test__c"
    )
    assert field["description"] == original_description
    assert backup.rollback_calls == ["backup-test-id"]
