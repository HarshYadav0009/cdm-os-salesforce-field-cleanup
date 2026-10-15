from servers.salesforce.apex_scanner import SalesforceApexScanner


class FlowMetadataClient:
    def __init__(self):
        self.queries = []

    def tooling_query(self, soql):
        self.queries.append(soql)
        if "SELECT Metadata FROM Flow" in soql:
            return {
                "records": [
                    {
                        "Metadata": {
                            "assignments": [
                                {"field": "Legacy_Field__c"}
                            ]
                        }
                    }
                ]
            }
        return {
            "records": [
                {
                    "Id": "301000000000001AAA",
                    "MasterLabel": "Legacy Field Cleanup",
                    "Description": "Demo flow",
                    "Status": "Active",
                    "VersionNumber": 2,
                }
            ]
        }


def test_scan_flows_queries_supported_fields_and_single_record_metadata():
    client = FlowMetadataClient()
    scanner = SalesforceApexScanner(client)

    matches = scanner.scan_flows("Legacy_Field__c")

    assert len(matches) == 1
    assert matches[0]["name"] == "Legacy Field Cleanup"
    assert matches[0]["version"] == 2
    assert "DeveloperName" not in client.queries[0]
    assert "Metadata FROM Flow WHERE Id" in client.queries[1]
    assert "LIMIT 1" in client.queries[1]


def test_scan_flows_returns_empty_when_field_is_not_referenced():
    scanner = SalesforceApexScanner(FlowMetadataClient())

    assert scanner.scan_flows("Missing_Field__c") == []


class LightningResourceClient:
    def __init__(self):
        self.query = ""

    def tooling_query(self, soql):
        self.query = soql
        return {
            "records": [
                {
                    "Id": "0Rd000000000001AAA",
                    "LightningComponentBundleId": "0Rb000000000001AAA",
                    "LightningComponentBundle": {
                        "DeveloperName": "accountSummary"
                    },
                    "FilePath": "lwc/accountSummary/accountSummary.js",
                    "Source": "return record.Customer_Tier__c;",
                }
            ]
        }


def test_scan_lwc_reads_source_from_lightning_component_resource():
    client = LightningResourceClient()
    scanner = SalesforceApexScanner(client)

    matches = scanner.scan_lwc("Customer_Tier__c")

    assert len(matches) == 1
    assert matches[0]["name"] == "accountSummary"
    assert matches[0]["id"] == "0Rb000000000001AAA"
    assert "LightningComponentResource" in client.query
    assert "LightningComponentBundle.DeveloperName" in client.query
    assert "Source FROM LightningComponentBundle" not in client.query
