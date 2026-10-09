from types import SimpleNamespace

import pytest
from servers.salesforce.client import SalesforceClient


def test_salesforce_client_mock_mode():
    client = SalesforceClient(mock_mode=True)
    assert client.is_mock is True


def test_mock_org_type_is_not_misrepresented():
    client = SalesforceClient(mock_mode=True)
    assert client.get_org_type() == "Mock"


def test_org_type_can_be_explicitly_configured(monkeypatch):
    monkeypatch.setenv("SF_ORG_TYPE", "uat")
    client = SalesforceClient(mock_mode=True)
    assert client.get_org_type() == "UAT"


@pytest.mark.parametrize(
    ("organization", "expected"),
    [
        ({"IsSandbox": True, "OrganizationType": "Enterprise Edition"}, "Sandbox"),
        ({"IsSandbox": False, "OrganizationType": "Developer Edition"}, "Developer"),
        ({"IsSandbox": False, "OrganizationType": "Enterprise Edition"}, "Production"),
    ],
)
def test_org_type_is_detected_from_salesforce_metadata(organization, expected, monkeypatch):
    monkeypatch.delenv("SF_ORG_TYPE", raising=False)
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = SimpleNamespace(
        query=lambda _: {"records": [organization]},
    )

    assert client.get_org_type() == expected


def test_org_details_returns_sandbox_name_and_type(monkeypatch):
    monkeypatch.delenv("SF_ORG_TYPE", raising=False)
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = SimpleNamespace(
        query=lambda _: {
            "records": [
                {
                    "Name": "Muskansb",
                    "IsSandbox": True,
                    "OrganizationType": "Enterprise Edition",
                }
            ]
        },
    )

    assert client.get_org_details() == {
        "org_type": "Sandbox",
        "org_name": "Muskansb",
    }


def test_invalid_org_type_override_is_reported(monkeypatch):
    monkeypatch.setenv("SF_ORG_TYPE", "staging")
    client = SalesforceClient(mock_mode=True)

    with pytest.raises(ValueError, match="SF_ORG_TYPE must be"):
        client.get_org_type()


def test_logged_in_org_user_name_is_queried_from_salesforce():
    queries = []
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = SimpleNamespace(
        user_id="005000000000001AAA",
        query=lambda soql: queries.append(soql) or {"records": [{"Name": "Alex Admin"}]},
    )

    assert client.get_org_user_name() == "Alex Admin"
    assert queries == [
        "SELECT Name FROM User WHERE Id = '005000000000001AAA' LIMIT 1"
    ]


def test_logged_in_org_user_name_falls_back_when_session_user_id_is_invalid():
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.username = "configured.user@example.com"
    client.sf = SimpleNamespace(user_id="005' OR Id != ''")

    assert client.get_org_user_name() is None


def test_logged_in_org_user_name_looks_up_full_name_by_username():
    queries = []
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.username = "configured.user@example.com"
    client.sf = SimpleNamespace(
        user_id=None,
        query=lambda soql: queries.append(soql)
        or {"records": [{"Name": "Alex Admin"}]},
    )

    assert client.get_org_user_name() == "Alex Admin"
    assert queries == [
        "SELECT Name FROM User WHERE Username = 'configured.user@example.com' LIMIT 1"
    ]


def test_logged_in_org_user_name_uses_username_query_when_user_id_lookup_is_empty():
    queries = []
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.username = "configured.user@example.com"

    def query(soql):
        queries.append(soql)
        if "WHERE Id" in soql:
            return {"records": []}
        return {"records": [{"Name": "Alex Admin"}]}

    client.sf = SimpleNamespace(user_id="005000000000001AAA", query=query)

    assert client.get_org_user_name() == "Alex Admin"
    assert len(queries) == 2
    assert "WHERE Username" in queries[1]


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
