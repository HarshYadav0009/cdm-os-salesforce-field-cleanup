from types import SimpleNamespace

from servers.salesforce.apex_references import ApexReferenceScanner
from servers.salesforce.field_assessment import _risk_level, RISK_REVIEW
from servers.salesforce.client import SalesforceClient


def test_validation_reads_metadata_and_ignores_inactive_or_substring_matches():
    client = SimpleNamespace(read_object_metadata=lambda _: {"validationRules": [
        {"fullName": "ActiveRequired", "active": True, "errorConditionFormula": "ISBLANK(Active__c)"},
        {"fullName": "Inactive", "active": False, "errorConditionFormula": "Active__c"},
        {"fullName": "Other", "active": True, "errorConditionFormula": "OtherActive__c"},
    ]})
    result = ApexReferenceScanner(client).scan_validation_rules("Account", "Active__c")
    assert [item["name"] for item in result] == ["ActiveRequired"]


def test_page_and_compact_layouts_are_checked_by_exact_field_name():
    client = SimpleNamespace(
        read_page_layouts=lambda _: [
            {"name": "Account Layout", "metadata": {"layoutSections": [{"layoutColumns": [{"layoutItems": [{"field": "Active__c"}]}]}]}},
            {"name": "Other Layout", "metadata": {"field": "OtherActive__c"}},
        ],
        read_object_metadata=lambda _: {"compactLayouts": [{"fullName": "Compact", "fields": ["Name", "Active__c"]}]},
    )
    result = ApexReferenceScanner(client).scan_layouts("Account", "Active__c")
    assert [item["type"] for item in result] == ["Layout", "CompactLayout"]


def test_failed_page_scan_preserves_compact_results_and_error():
    def fail(_):
        raise RuntimeError("Insufficient permissions")
    client = SimpleNamespace(read_page_layouts=fail, read_object_metadata=lambda _: {"compactLayouts": [{"fullName": "Compact", "fields": ["Active__c"]}]})
    result = ApexReferenceScanner(client).scan_layouts("Account", "Active__c")
    assert result[0]["scan_error"] == "Insufficient permissions"
    assert result[1]["type"] == "CompactLayout"


def test_failed_scan_does_not_return_safe_risk():
    assert _risk_level({"usage_percentage": 0}, {"layouts": [{"scan_error": "Failed"}]}) == RISK_REVIEW


def test_object_metadata_is_read_once_per_client():
    calls = []
    def read(names):
        calls.append(names)
        return {"fullName": "Account", "validationRules": []}
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.sf = SimpleNamespace(mdapi=SimpleNamespace(CustomObject=SimpleNamespace(read=read)))
    assert client.read_object_metadata("Account")["fullName"] == "Account"
    client.read_object_metadata("Account")
    assert calls == [["Account"]]


def test_custom_object_layout_query_resolves_id_and_fetches_one_metadata_record():
    calls = []
    def query(soql):
        calls.append(soql)
        if "EntityDefinition" in soql:
            return {"records": [{"DurableId": "01I000000000001"}]}
        if "SELECT Id, Name" in soql:
            return {"records": [{"Id": "00h000000000001", "Name": "Invoice Layout"}]}
        return {"records": [{"Metadata": {"layoutSections": []}}]}
    client = SalesforceClient.__new__(SalesforceClient)
    client._mock_mode = False
    client.tooling_query = query
    result = client.read_page_layouts("Invoice__c")
    assert result[0]["name"] == "Invoice Layout"
    assert "TableEnumOrId = '01I000000000001'" in calls[1]
    assert calls[2] == "SELECT Metadata FROM Layout WHERE Id = '00h000000000001' LIMIT 1"
