import re
import logging
from typing import Dict, Any, List, Optional
from .client import SalesforceClient
from .validators import validate_salesforce_identifier

logger = logging.getLogger("salesforce.apex_scanner")


class SalesforceApexScanner:
    """
    Advanced Scanner for Salesforce Apex classes, Triggers, Flows, and LWCs.
    Identifies code and metadata dependencies for a field to ensure safe lifecycle actions.
    """

    def __init__(self, client: Optional[SalesforceClient] = None):
        self.client = client if client is not None else SalesforceClient()

    def scan_apex_classes(self, field_name: str) -> List[Dict[str, Any]]:
        """Search Apex classes for occurrences of field API name."""
        field_name = validate_salesforce_identifier(field_name)
        pattern = re.compile(rf"\b{re.escape(field_name)}\b", re.IGNORECASE)

        soql = "SELECT Id, Name, Body FROM ApexClass"
        res = self.client.tooling_query(soql)
        matches = []

        for record in res.get("records", []):
            body = record.get("Body", "") or ""
            lines = body.split("\n")
            for line_no, line in enumerate(lines, start=1):
                if pattern.search(line):
                    matches.append({
                        "type": "ApexClass",
                        "id": record.get("Id"),
                        "name": record.get("Name"),
                        "line_number": line_no,
                        "snippet": line.strip()
                    })

        return matches

    def scan_apex_triggers(self, object_name: str, field_name: str) -> List[Dict[str, Any]]:
        """Search Apex triggers for occurrences of field API name on specified object."""
        field_name = validate_salesforce_identifier(field_name)
        pattern = re.compile(rf"\b{re.escape(field_name)}\b", re.IGNORECASE)

        soql = "SELECT Id, Name, TableEnumOrId, Body FROM ApexTrigger"
        res = self.client.tooling_query(soql)
        matches = []

        for record in res.get("records", []):
            table = record.get("TableEnumOrId", "")
            if object_name and table and table.lower() != object_name.lower():
                continue

            body = record.get("Body", "") or ""
            lines = body.split("\n")
            for line_no, line in enumerate(lines, start=1):
                if pattern.search(line):
                    matches.append({
                        "type": "ApexTrigger",
                        "id": record.get("Id"),
                        "name": record.get("Name"),
                        "object": table,
                        "line_number": line_no,
                        "snippet": line.strip()
                    })

        return matches

    def scan_flows(self, field_name: str) -> List[Dict[str, Any]]:
        """Search active and draft Flows for references to field API name."""
        field_name = validate_salesforce_identifier(field_name)
        pattern = re.compile(rf"\b{re.escape(field_name)}\b", re.IGNORECASE)

        soql = "SELECT Id, DeveloperName, Description, Metadata FROM Flow"
        res = self.client.tooling_query(soql)
        matches = []

        for record in res.get("records", []):
            dev_name = record.get("DeveloperName", "")
            desc = record.get("Description", "") or ""
            metadata_str = str(record.get("Metadata", ""))

            if pattern.search(metadata_str) or pattern.search(desc):
                matches.append({
                    "type": "Flow",
                    "id": record.get("Id"),
                    "name": dev_name,
                    "description": desc,
                    "snippet": f"Referenced in flow metadata definition '{dev_name}'"
                })

        return matches

    def scan_lwc(self, field_name: str) -> List[Dict[str, Any]]:
        """Search Lightning Web Components for references to field API name."""
        field_name = validate_salesforce_identifier(field_name)
        pattern = re.compile(rf"\b{re.escape(field_name)}\b", re.IGNORECASE)

        soql = "SELECT Id, DeveloperName, Source FROM LightningComponentBundle"
        res = self.client.tooling_query(soql)
        matches = []

        for record in res.get("records", []):
            source = record.get("Source", "") or ""
            dev_name = record.get("DeveloperName", "")
            if pattern.search(source):
                matches.append({
                    "type": "LightningComponentBundle",
                    "id": record.get("Id"),
                    "name": dev_name,
                    "snippet": f"Referenced in LWC bundle '{dev_name}'"
                })

        return matches

    def scan_all_references(self, object_name: str, field_name: str) -> Dict[str, Any]:
        """
        Scan all Salesforce development artifacts (Apex, Triggers, Flows, LWCs)
        for references to the field.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        apex_matches = self.scan_apex_classes(field_name)
        trigger_matches = self.scan_apex_triggers(object_name, field_name)
        flow_matches = self.scan_flows(field_name)
        lwc_matches = self.scan_lwc(field_name)

        all_refs = apex_matches + trigger_matches + flow_matches + lwc_matches
        has_refs = len(all_refs) > 0

        summary = (
            f"Found {len(all_refs)} reference(s) across Salesforce code/metadata: "
            f"{len(apex_matches)} Apex class, {len(trigger_matches)} Trigger, "
            f"{len(flow_matches)} Flow, {len(lwc_matches)} LWC."
            if has_refs
            else "No references found in Apex, Triggers, Flows, or LWCs."
        )

        return {
            "object": object_name,
            "field": field_name,
            "has_references": has_refs,
            "reference_count": len(all_refs),
            "apex_classes": apex_matches,
            "triggers": trigger_matches,
            "flows": flow_matches,
            "lwcs": lwc_matches,
            "all_references": all_refs,
            "safe_to_cleanup": not has_refs,
            "summary": summary
        }
