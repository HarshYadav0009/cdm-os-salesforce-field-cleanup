from types import SimpleNamespace

import pytest
from servers.salesforce.client import SalesforceClient


def test_salesforce_client_mock_mode():
    client = SalesforceClient(mock_mode=True)
    assert client.is_mock is True


def test_salesforce_client_mock_query_total():
    client = SalesforceClient(mock_mode=True)
    res = client.query("SELECT COUNT(Id) total FROM Account")
    assert res["done"] is True
    assert len(res["records"]) == 1
    assert res["records"][0]["total"] == 120


def test_salesforce_client_mock_query_populated():
    client = SalesforceClient(mock_mode=True)
    # Zero populated field
    res_zero = client.query("SELECT COUNT(Id) populated FROM Account WHERE Legacy_Cleanup_Test__c != NULL")
    assert res_zero["records"][0]["populated"] == 0

    # Populated field
    res_pop = client.query("SELECT COUNT(Id) populated FROM Account WHERE Active_Discount__c != NULL")
    assert res_pop["records"][0]["populated"] == 105


def test_salesforce_client_tooling_queries():
    client = SalesforceClient(mock_mode=True)

    apex_res = client.tooling_query("SELECT Id, Name, Body FROM ApexClass")
    assert apex_res["done"] is True
    assert len(apex_res["records"]) > 0

    flow_res = client.tooling_query("SELECT Id, DeveloperName, Description FROM Flow")
    assert flow_res["done"] is True
    assert len(flow_res["records"]) > 0


def test_salesforce_client_describe():
    client = SalesforceClient(mock_mode=True)
    desc = client.describe("Account")
    assert desc["name"] == "Account"
    assert len(desc["fields"]) > 0

    # Invalid object
    with pytest.raises(ValueError, match="not found"):
        client.describe("NonExistentObject__c")


def test_salesforce_client_describe_global():
    client = SalesforceClient(mock_mode=True)
    g = client.describe_global()
    assert "sobjects" in g
    names = [s["name"] for s in g["sobjects"]]
    assert "Account" in names
    assert "Custom_Invoice__c" in names


def test_live_field_description_uses_metadata_api():
    component = SimpleNamespace(fullName="Case.POC_test__c", description="")
    read_calls = []
    update_calls = []
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = SimpleNamespace(
        mdapi=SimpleNamespace(
            CustomField=SimpleNamespace(
                read=lambda names: read_calls.append(names) or component,
                update=lambda components: update_calls.append(components),
            )
        )
    )

    assert client.update_field_description(
        "Case", "POC_test__c", "[DEPRECATED] Test field"
    )

    assert read_calls == [["Case.POC_test__c"]]
    assert update_calls == [[component]]
    assert component.description == "[DEPRECATED] Test field"


def test_live_field_permissions_do_not_report_mock_update_as_success():
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = object()

    with pytest.raises(NotImplementedError, match="not implemented"):
        client.update_field_permissions(
            "Case",
            "POC_test__c",
            readable=False,
            editable=False,
        )
