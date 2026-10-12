from types import SimpleNamespace

import pytest

from servers.salesforce.bulk_scanner import SalesforceBulkScanner
from servers.salesforce.metadata import SalesforceMetadataService
from servers.salesforce.validators import validate_salesforce_identifier


def field(name, **kwargs):
    return {"name": name, "label": name, "custom": True, "type": "string", **kwargs}


def scanner(fields, population=None, references=None, total=None):
    return SalesforceBulkScanner(
        client=object(),
        metadata_service=SimpleNamespace(describe_object=lambda name: {"fields": fields}),
        usage_service=SimpleNamespace(
            get_total_records=total or (lambda name: 100),
            get_populated_records=population or (lambda obj, name: 0),
            calculate_usage=lambda total, populated: populated / total * 100,
        ),
        apex_scanner=SimpleNamespace(scan_all_references=references or (lambda obj, name: {
            "has_references": False, "reference_count": 0, "summary": "No references",
        })),
    )


@pytest.mark.parametrize("metadata", [{"filterable": False}, {"type": "encryptedstring"}])
def test_unsupported_field_is_not_queried_or_classified_as_empty(metadata):
    queried = []

    def population(obj, name):
        queried.append(name)
        return 0

    result = scanner([field("Encrypted_field__c", **metadata), field("Empty__c", filterable=True)], population=population).scan_objects(["Account"])
    assert queried == ["Empty__c"]
    assert [item["field"] for item in result["candidates"]] == ["Empty__c"]
    assert result["skipped_fields"][0]["field"] == "Encrypted_field__c"
    assert result["skipped_fields"][0]["classification"] == "NOT_ASSESSED"
    assert result["total_custom_fields_scanned"] == 1
    assert result["total_custom_fields_discovered"] == 2
    assert result["partial_scan"] is True


@pytest.mark.parametrize("stage", ["population", "references"])
def test_field_error_does_not_abort_remaining_fields_or_objects(stage):
    def fail(obj, name):
        if obj == "Account" and name == "Broken__c":
            raise RuntimeError("field can not be filtered in a query call")
        return 0 if stage == "population" else {"has_references": False, "reference_count": 0, "summary": "No references"}

    result = scanner([field("Broken__c"), field("Empty__c")], **{stage: fail}).scan_objects(["Account", "Contact"])
    assert result["total_candidates_found"] == 3
    assert result["total_skipped_fields"] == 1
    assert result["skipped_fields"][0]["stage"] == stage
    assert "can not be filtered" in result["skipped_fields"][0]["reason"]
    assert result["breakdown_by_object"]["Account"]["skipped_count"] == 1


def test_object_count_failure_does_not_abort_next_object():
    def total(obj):
        if obj == "Account":
            raise RuntimeError("No query access")
        return 100

    result = scanner([field("Empty__c")], total=total).scan_objects(["Account", "Contact"])
    assert result["total_candidates_found"] == 1
    assert result["object_errors"] == [{"object": "Account", "stage": "record_count", "reason": "No query access"}]
    assert "Account" not in result["breakdown_by_object"]


def test_filterable_encrypted_field_is_still_assessed():
    result = scanner([field("Shield__c", filterable=True, encrypted=True)]).scan_objects(["Account"])
    assert result["total_candidates_found"] == 1
    assert result["skipped_fields"] == []


def test_describe_preserves_query_capabilities():
    client = SimpleNamespace(describe=lambda name: {"name": name, "fields": [field("Encrypted__c", filterable=False, encrypted=True)]})
    metadata = SalesforceMetadataService(client).describe_object("Account")["fields"][0]
    assert metadata["filterable"] is False
    assert metadata["encrypted"] is True


def test_bulk_reuses_reference_reads_but_refreshes_them_on_next_scan():
    calls = []
    client = SimpleNamespace(tooling_query=lambda query: calls.append(query) or {"records": []})
    bulk = scanner([field("First__c"), field("Second__c")])
    cached = SalesforceBulkScanner(client=client, metadata_service=bulk.metadata, usage_service=bulk.usage)
    assert cached.scan_objects(["Account"])["total_candidates_found"] == 2
    first_count = len(calls)
    assert first_count == 4
    cached.scan_objects(["Account"])
    assert len(calls) == first_count * 2


def test_failed_reference_read_is_retried_for_next_field():
    attempts = []
    def query(soql):
        if "ApexClass" in soql:
            attempts.append(soql)
            if len(attempts) == 1:
                raise RuntimeError("Temporary failure")
        return {"records": []}
    bulk = scanner([field("First__c"), field("Second__c")])
    cached = SalesforceBulkScanner(client=SimpleNamespace(tooling_query=query), metadata_service=bulk.metadata, usage_service=bulk.usage)
    result = cached.scan_objects(["Account"])
    assert len(attempts) == 2
    assert result["total_skipped_fields"] == 1
    assert [item["field"] for item in result["candidates"]] == ["Second__c"]


@pytest.mark.parametrize("name", ["Website__pc", "rcsfl__SMS_Number__pc", "Account__History", "Invoice__r"])
def test_salesforce_namespaced_and_person_account_identifiers_are_supported(name):
    assert validate_salesforce_identifier(name) == name


@pytest.mark.parametrize("name", ["Name FROM Account", "Id' OR Name != ''", "Account;DROP", "../Account"])
def test_identifier_validation_still_rejects_query_and_path_characters(name):
    with pytest.raises(ValueError):
        validate_salesforce_identifier(name)


def test_population_maximum_is_inclusive_and_preserves_dependency_classification():
    counts = {"Empty__c": 0, "Boundary__c": 25, "Referenced__c": 10, "Above__c": 26}
    bulk = scanner([field(name) for name in counts], population=lambda obj, name: counts[name], references=lambda obj, name: {"has_references": name == "Referenced__c", "reference_count": int(name == "Referenced__c"), "summary": "Checked"})
    result = bulk.scan_objects(["Account"], threshold_percentage=25)
    assert result["threshold_percentage"] == 25
    assert {item["field"] for item in result["candidates"]} == {"Empty__c", "Boundary__c"}
    assert [item["field"] for item in result["needs_review"]] == ["Referenced__c"]
    assert [item["field"] for item in result["active_fields"]] == ["Above__c"]
