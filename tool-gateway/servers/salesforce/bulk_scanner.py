import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .field_usage import SalesforceFieldUsageService
from .apex_scanner import SalesforceApexScanner

logger = logging.getLogger("salesforce.bulk_scanner")


class SalesforceBulkScanner:
    """
    Bulk Scanner across standard CRM objects (Account, Contact, Opportunity)
    and custom SObjects.
    Performs field usage analysis coupled with Apex/Flow dependency scanning.
    """

    DEFAULT_OBJECTS = ["Account", "Contact", "Opportunity", "Custom_Invoice__c"]

    def __init__(
        self,
        client: Optional[SalesforceClient] = None,
        metadata_service: Optional[SalesforceMetadataService] = None,
        usage_service: Optional[SalesforceFieldUsageService] = None,
        apex_scanner: Optional[SalesforceApexScanner] = None,
    ):
        self.client = client if client is not None else SalesforceClient()
        self.metadata = metadata_service if metadata_service else SalesforceMetadataService(self.client)
        self.usage = usage_service if usage_service else SalesforceFieldUsageService(self.client)
        self.scanner = apex_scanner if apex_scanner else SalesforceApexScanner(self.client)

    def scan_objects(
        self,
        object_names: Optional[List[str]] = None,
        threshold_percentage: float = 0.0
    ) -> Dict[str, Any]:
        """
        Execute full bulk scan across specified SObjects.
        """
        if not object_names:
            # Auto-discover or use defaults
            try:
                g = self.metadata.describe_global()
                # Include standard core + all custom SObjects
                candidates = ["Account", "Contact", "Opportunity"] + g.get("custom_sobjects", [])
                # Deduplicate while preserving order
                object_names = list(dict.fromkeys(candidates))
            except Exception:
                object_names = self.DEFAULT_OBJECTS

        logger.info(f"Initiating bulk scan across {len(object_names)} SObjects: {object_names}")

        candidates = []
        needs_review = []
        active_fields = []
        breakdown_by_object = {}

        total_custom_fields = 0

        for obj_name in object_names:
            try:
                desc = self.metadata.describe_object(obj_name)
            except Exception as e:
                logger.warning(f"Could not describe object {obj_name}: {e}")
                continue

            custom_fields = [f for f in desc.get("fields", []) if f.get("custom")]
            total_custom_fields += len(custom_fields)

            total_records = self.usage.get_total_records(obj_name)
            obj_candidates = []
            obj_needs_review = []
            obj_active = []

            for f in custom_fields:
                f_name = f["name"]
                pop_count = self.usage.get_populated_records(obj_name, f_name)
                usage_pct = self.usage.calculate_usage(total_records, pop_count)

                # Check references
                ref_res = self.scanner.scan_all_references(obj_name, f_name)
                has_refs = ref_res["has_references"]

                item = {
                    "object": obj_name,
                    "field": f_name,
                    "label": f.get("label"),
                    "type": f.get("type"),
                    "total_records": total_records,
                    "populated_records": pop_count,
                    "usage_percentage": usage_pct,
                    "has_references": has_refs,
                    "reference_count": ref_res["reference_count"],
                    "reference_summary": ref_res["summary"],
                }

                if usage_pct <= threshold_percentage and not has_refs:
                    item["classification"] = "CANDIDATE_FOR_CLEANUP"
                    candidates.append(item)
                    obj_candidates.append(item)
                elif usage_pct <= threshold_percentage and has_refs:
                    item["classification"] = "NEEDS_REVIEW_HAS_DEPENDENCIES"
                    item["warning"] = "0% populated, but referenced in Salesforce code or flows!"
                    needs_review.append(item)
                    obj_needs_review.append(item)
                else:
                    item["classification"] = "ACTIVE_IN_USE"
                    active_fields.append(item)
                    obj_active.append(item)

            breakdown_by_object[obj_name] = {
                "total_records": total_records,
                "custom_fields_count": len(custom_fields),
                "candidates_count": len(obj_candidates),
                "needs_review_count": len(obj_needs_review),
                "active_count": len(obj_active),
            }

        return {
            "scan_timestamp": datetime.now(timezone.utc).isoformat(),
            "objects_scanned": object_names,
            "total_objects_scanned": len(object_names),
            "total_custom_fields_scanned": total_custom_fields,
            "total_candidates_found": len(candidates),
            "total_needs_review": len(needs_review),
            "total_active_in_use": len(active_fields),
            "breakdown_by_object": breakdown_by_object,
            "candidates": candidates,
            "needs_review": needs_review,
            "active_fields": active_fields,
        }
