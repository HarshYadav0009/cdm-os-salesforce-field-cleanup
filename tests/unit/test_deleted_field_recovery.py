import pytest

from servers.salesforce.backup_service import SalesforceBackupService
from servers.salesforce.client import SalesforceClient


def test_description_restore_rejects_deleted_field_and_preserves_backup(tmp_path):
    client = SalesforceClient(mock_mode=True)
    service = SalesforceBackupService(client, backup_dir=str(tmp_path))
    backup = service.backup_field_definition("Account", "Legacy_Cleanup_Test__c")
    client.delete_custom_field("Account", "Legacy_Cleanup_Test__c")
    with pytest.raises(ValueError, match="Deleted Fields > Undelete"):
        service.rollback_field(backup["backup_id"])
    assert service.get_backup(backup["backup_id"])["field_name"] == "Legacy_Cleanup_Test__c"
    assert list(tmp_path.glob("*.json"))


def test_description_restore_still_works_for_existing_field(tmp_path):
    client = SalesforceClient(mock_mode=True)
    service = SalesforceBackupService(client, backup_dir=str(tmp_path))
    backup = service.backup_field_definition("Account", "Legacy_Cleanup_Test__c")
    client.update_field_description("Account", "Legacy_Cleanup_Test__c", "Changed")
    result = service.rollback_field(backup["backup_id"])
    assert result["description_restored"] is True
    assert result["restored_description"] == backup["metadata_snapshot"]["description"]
