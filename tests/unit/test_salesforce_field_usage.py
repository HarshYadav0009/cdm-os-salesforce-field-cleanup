import pytest
from servers.salesforce.client import SalesforceClient
from servers.salesforce.field_usage import SalesforceFieldUsageService


@pytest.fixture
def usage_service():
    client = SalesforceClient(mock_mode=True)
    return SalesforceFieldUsageService(client)


def test_get_total_records(usage_service):
    total = usage_service.get_total_records("Account")
    assert total == 120


def test_get_populated_records(usage_service):
    zero_pop = usage_service.get_populated_records("Account", "Legacy_Cleanup_Test__c")
    assert zero_pop == 0

    active_pop = usage_service.get_populated_records("Account", "Active_Discount__c")
    assert active_pop == 105


def test_calculate_usage(usage_service):
    assert usage_service.calculate_usage(100, 0) == 0.0
    assert usage_service.calculate_usage(100, 50) == 50.0
    assert usage_service.calculate_usage(120, 105) == 87.5
    assert usage_service.calculate_usage(0, 0) == 0.0


def test_query_field_usage_zero_candidate(usage_service):
    res = usage_service.query_field_usage("Account", "Legacy_Cleanup_Test__c")
    assert res["object"] == "Account"
    assert res["field"] == "Legacy_Cleanup_Test__c"
    assert res["total_records"] == 120
    assert res["populated_records"] == 0
    assert res["usage_percentage"] == 0.0
    assert res["zero_usage_candidate"] is True
    assert "Candidate for deprecation" in res["recommendation_hint"]


def test_query_field_usage_active_field(usage_service):
    res = usage_service.query_field_usage("Account", "Active_Discount__c")
    assert res["zero_usage_candidate"] is False
    assert res["usage_percentage"] > 0
    assert "In use" in res["recommendation_hint"]


def test_analyze_object_custom_fields(usage_service):
    fields = ["Legacy_Cleanup_Test__c", "Active_Discount__c"]
    results = usage_service.analyze_object_custom_fields("Account", fields)
    assert len(results) == 2
    assert results[0]["zero_usage_candidate"] is True
    assert results[1]["zero_usage_candidate"] is False
