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
