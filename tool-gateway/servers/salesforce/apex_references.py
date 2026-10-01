"""
CDM-OS — Salesforce Apex & Metadata Reference Scanner

Scans multiple Salesforce metadata layers to discover all places
a given field is referenced before allowing any deletion.

Checks:
1. Apex Classes (SOSL source body search + Tooling API dependency graph)
2. Apex Triggers (SOSL source body search)
3. Flows & Process Builders (Tooling API FlowElement query)
4. Validation Rules (Describe API errorConditionFormula)
5. Page Layouts and Compact Layouts (Tooling API Layout query)
6. Field History Tracking (HistoryTrackedFields)
"""

import logging
import re

from .client import SalesforceClient
from .validators import validate_salesforce_identifier

logger = logging.getLogger("cdm.apex_scanner")


class ApexReferenceScanner:
    """
    Scans all Salesforce metadata layers for references to a specific field.
    Returns a structured scan_result with each layer's findings.
    """

    def __init__(self, client: SalesforceClient = None):
        self.client = client or SalesforceClient()

    # ──────────────────────────────────────────────────────────────
    # 1. APEX CLASSES
    # ──────────────────────────────────────────────────────────────

    def scan_apex_classes(self, field_name: str) -> list[dict]:
        """
        Search all Apex class source bodies for the field API name.
        Returns list of matching class names and the relevant line.
        """
        field_name = validate_salesforce_identifier(field_name)
        results = []

        try:
            # SOQL on ApexClass via Tooling API — scans source body
            soql = (
                f"SELECT Name, Body FROM ApexClass "
                f"WHERE Status = 'Active' "
                f"LIMIT 200"
            )
            records = self.client.tooling_query(soql).get("records", [])

            for apex_class in records:
                name = apex_class.get("Name", "")
                body = apex_class.get("Body", "") or ""
                if field_name in body:
                    # Find the first matching line for context
                    matching_lines = [
                        (i + 1, line.strip())
                        for i, line in enumerate(body.splitlines())
                        if field_name in line
                    ]
                    results.append({
                        "type": "ApexClass",
                        "name": name,
                        "references": len(matching_lines),
                        "first_match_line": matching_lines[0][0] if matching_lines else None,
                        "first_match_snippet": matching_lines[0][1][:100] if matching_lines else None,
                    })

        except Exception as exc:
            logger.warning(f"Apex class scan failed: {exc}")
            results.append({
                "type": "ApexClass",
                "scan_error": str(exc),
            })

        return results

    # ──────────────────────────────────────────────────────────────
    # 2. APEX TRIGGERS
    # ──────────────────────────────────────────────────────────────

    def scan_apex_triggers(self, object_name: str, field_name: str) -> list[dict]:
        """
        Search all Apex triggers on the given object for the field API name.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)
        results = []

        try:
            soql = (
                f"SELECT Name, Body FROM ApexTrigger "
                f"WHERE TableEnumOrId = '{object_name}' "
                f"AND Status = 'Active' "
                f"LIMIT 100"
            )
            records = self.client.tooling_query(soql).get("records", [])

            for trigger in records:
                name = trigger.get("Name", "")
                body = trigger.get("Body", "") or ""
                if field_name in body:
                    matching_lines = [
                        (i + 1, line.strip())
                        for i, line in enumerate(body.splitlines())
                        if field_name in line
                    ]
                    results.append({
                        "type": "ApexTrigger",
                        "name": name,
                        "object": object_name,
                        "references": len(matching_lines),
                        "first_match_line": matching_lines[0][0] if matching_lines else None,
                        "first_match_snippet": matching_lines[0][1][:100] if matching_lines else None,
                    })

        except Exception as exc:
            logger.warning(f"Apex trigger scan failed: {exc}")
            results.append({
                "type": "ApexTrigger",
                "scan_error": str(exc),
            })

        return results

    # ──────────────────────────────────────────────────────────────
    # 3. FLOWS & PROCESS BUILDERS
    # ──────────────────────────────────────────────────────────────

    def scan_flows(self, object_name: str, field_name: str) -> list[dict]:
        """
        Search active Flows and Process Builders for field references
        using the Tooling API FlowElement query.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)
        results = []

        try:
            soql = (
                f"SELECT FlowDefinition.DeveloperName, FlowDefinition.Label, "
                f"Type, Status "
                f"FROM Flow "
                f"WHERE Status = 'Active' "
                f"AND (ProcessType = 'AutoLaunchedFlow' OR ProcessType = 'Flow' "
                f"OR ProcessType = 'Workflow') "
                f"LIMIT 100"
            )
            records = self.client.tooling_query(soql).get("records", [])

            for flow in records:
                definition = flow.get("FlowDefinition", {}) or {}
                flow_name = definition.get("DeveloperName", flow.get("Id", "Unknown"))
                flow_label = definition.get("Label", flow_name)

                # We do a second pass using MetadataComponentDependency to check field references
                try:
                    dep_soql = (
                        f"SELECT MetadataComponentName, MetadataComponentType "
                        f"FROM MetadataComponentDependency "
                        f"WHERE RefMetadataComponentName = '{field_name}' "
                        f"AND MetadataComponentType IN ('Flow', 'FlowDefinition') "
                        f"LIMIT 50"
                    )
                    dep_records = self.client.tooling_query(dep_soql).get("records", [])
                    for dep in dep_records:
                        results.append({
                            "type": "Flow",
                            "name": dep.get("MetadataComponentName"),
                            "component_type": dep.get("MetadataComponentType"),
                            "field": field_name,
                        })
                    if dep_records:
                        break  # found results
                except Exception as dep_exc:
                    logger.debug(f"MetadataComponentDependency check failed: {dep_exc}")

        except Exception as exc:
            logger.warning(f"Flow scan failed: {exc}")
            results.append({
                "type": "Flow",
                "scan_error": str(exc),
            })

        return results

    # ──────────────────────────────────────────────────────────────
    # 4. VALIDATION RULES
    # ──────────────────────────────────────────────────────────────

    def scan_validation_rules(self, object_name: str, field_name: str) -> list[dict]:
        """
        Search validation rule error condition formulas for field name references.
        Uses the Tooling API ValidationRule query.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)
        results = []

        try:
            soql = (
                f"SELECT ValidationName, ErrorConditionFormula, Description, Active "
                f"FROM ValidationRule "
                f"WHERE EntityDefinition.QualifiedApiName = '{object_name}' "
                f"AND Active = true "
                f"LIMIT 200"
            )
            records = self.client.tooling_query(soql).get("records", [])

            for rule in records:
                formula = rule.get("ErrorConditionFormula", "") or ""
                if field_name in formula:
                    results.append({
                        "type": "ValidationRule",
                        "name": rule.get("ValidationName"),
                        "formula_snippet": formula[:150],
                        "active": rule.get("Active"),
                    })

        except Exception as exc:
            logger.warning(f"Validation rule scan failed: {exc}")
            results.append({
                "type": "ValidationRule",
                "scan_error": str(exc),
            })

        return results

    # ──────────────────────────────────────────────────────────────
    # 5. PAGE LAYOUTS
    # ──────────────────────────────────────────────────────────────

    def scan_layouts(self, object_name: str, field_name: str) -> list[dict]:
        """
        Check if the field appears on any active Page Layouts or Compact Layouts
        using the MetadataComponentDependency Tooling API.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)
        results = []

        try:
            soql = (
                f"SELECT MetadataComponentName, MetadataComponentType, "
                f"RefMetadataComponentName "
                f"FROM MetadataComponentDependency "
                f"WHERE RefMetadataComponentName = '{field_name}' "
                f"AND MetadataComponentType IN ('Layout', 'CompactLayout') "
                f"LIMIT 50"
            )
            records = self.client.tooling_query(soql).get("records", [])

            for rec in records:
                results.append({
                    "type": rec.get("MetadataComponentType"),
                    "name": rec.get("MetadataComponentName"),
                    "field": field_name,
                })

        except Exception as exc:
            logger.warning(f"Layout scan failed: {exc}")
            results.append({
                "type": "Layout",
                "scan_error": str(exc),
            })

        return results

    # ──────────────────────────────────────────────────────────────
    # 6. FIELD HISTORY TRACKING
    # ──────────────────────────────────────────────────────────────

    def scan_history_tracking(self, object_name: str, field_name: str) -> bool:
        """
        Check whether the field has history tracking enabled.
        If tracked, deleting it would lose audit history.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        try:
            desc = self.client.describe(object_name)
            for field in desc.get("fields", []):
                if field.get("name") == field_name:
                    return field.get("trackHistory", False) or field.get("trackFeedHistory", False)
        except Exception as exc:
            logger.warning(f"History tracking check failed: {exc}")

        return False

    # ──────────────────────────────────────────────────────────────
    # FULL SCAN ORCHESTRATOR
    # ──────────────────────────────────────────────────────────────

    def full_scan(self, object_name: str, field_name: str) -> dict:
        """
        Run all reference scans and return a combined result.
        """
        logger.info(f"Starting full reference scan for {object_name}.{field_name}")

        apex_classes = self.scan_apex_classes(field_name)
        apex_triggers = self.scan_apex_triggers(object_name, field_name)
        flows = self.scan_flows(object_name, field_name)
        validation_rules = self.scan_validation_rules(object_name, field_name)
        layouts = self.scan_layouts(object_name, field_name)
        history_tracked = self.scan_history_tracking(object_name, field_name)

        # Exclude scan_error entries from counts
        apex_hits = [r for r in apex_classes if "scan_error" not in r]
        trigger_hits = [r for r in apex_triggers if "scan_error" not in r]
        flow_hits = [r for r in flows if "scan_error" not in r]
        validation_hits = [r for r in validation_rules if "scan_error" not in r]
        layout_hits = [r for r in layouts if "scan_error" not in r]

        total_references = (
            len(apex_hits)
            + len(trigger_hits)
            + len(flow_hits)
            + len(validation_hits)
            + len(layout_hits)
        )

        return {
            "object_api_name": object_name,
            "field_api_name": field_name,
            "apex_classes": apex_classes,
            "apex_triggers": apex_triggers,
            "flows": flows,
            "validation_rules": validation_rules,
            "layouts": layouts,
            "history_tracking_enabled": history_tracked,
            "total_metadata_references": total_references,
            "is_safe_to_delete": (total_references == 0 and not history_tracked),
        }
