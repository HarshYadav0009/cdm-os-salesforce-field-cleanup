import pytest
from servers.salesforce.client import SalesforceClient
from servers.salesforce.metadata import SalesforceMetadataService


@pytest.fixture
def metadata_service():
    client = SalesforceClient(mock_mode=True)
    return SalesforceMetadataService(client)


def test_describe_global(metadata_service):
    res = metadata_service.describe_global()
    assert res["total_sobjects"] >= 4
    assert "Account" in res["standard_sobjects"]
    assert "Custom_Invoice__c" in res["custom_sobjects"]


def test_describe_object(metadata_service):
    desc = metadata_service.describe_object("Account")
    assert desc["object"] == "Account"
    assert desc["custom"] is False
    assert desc["total_fields"] > 0
    assert desc["custom_fields_count"] >= 4

    field_names = [f["name"] for f in desc["fields"]]
    assert "Id" in field_names
    assert "AccountNumber" in field_names
    assert "Legacy_Cleanup_Test__c" in field_names


def test_get_field_metadata(metadata_service):
    res = metadata_service.get_field_metadata("Account", "Legacy_Cleanup_Test__c")
    assert res["object"] == "Account"
    field = res["field"]
    assert field["name"] == "Legacy_Cleanup_Test__c"
    assert field["custom"] is True
    assert field["type"] == "textarea"

    # Non-existent field
    with pytest.raises(ValueError, match="not found"):
        metadata_service.get_field_metadata("Account", "Fake_Field__c")


def test_list_custom_fields(metadata_service):
    custom_fields = metadata_service.list_custom_fields("Account")
    assert len(custom_fields) >= 4
    for f in custom_fields:
        assert f["custom"] is True
        assert f["name"].endswith("__c")
