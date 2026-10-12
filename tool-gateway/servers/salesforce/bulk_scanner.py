import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .field_usage import SalesforceFieldUsageService
from .apex_scanner import SalesforceApexScanner

logger = logging.getLogger("salesforce.bulk_scanner")


class _ReferenceReadCache:
    """Reuse source metadata within one bulk run, without caching failures."""

    def __init__(self, client):
        self.client = client
        self.results = {}

    def tooling_query(self, soql):
        if soql not in self.results:
            self.results[soql] = self.client.tooling_query(soql)
        return self.results[soql]


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
        self.reference_cache = _ReferenceReadCache(self.client)
        self.scanner = apex_scanner if apex_scanner else SalesforceApexScanner(self.reference_cache)

    def scan_objects(
        self,
        object_names: Optional[List[str]] = None,
        threshold_percentage: float = 0.0
    ) -> Dict[str, Any]:
        """
        Execute full bulk scan across specified SObjects.
        """
        self.reference_cache.results.clear()
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
        skipped_fields = []
        object_errors = []
        breakdown_by_object = {}

        total_custom_fields = 0

        for obj_name in object_names:
            try:
                desc = self.metadata.describe_object(obj_name)
            except Exception as e:
                logger.warning(f"Could not describe object {obj_name}: {e}")
                object_errors.append({"object": obj_name, "stage": "metadata", "reason": str(e)})
                continue

            custom_fields = [f for f in desc.get("fields", []) if f.get("custom")]
            total_custom_fields += len(custom_fields)

            try:
                total_records = self.usage.get_total_records(obj_name)
            except Exception as e:
                object_errors.append({"object": obj_name, "stage": "record_count", "reason": str(e)})
                logger.warning(f"Could not count records for {obj_name}: {e}")
                continue
            obj_candidates = []
            obj_needs_review = []
            obj_active = []
            obj_skipped = []

            for f in custom_fields:
                f_name = f["name"]
                skipped = {
                    "object": obj_name, "field": f_name,
                    "label": f.get("label"), "type": f.get("type"),
                    "classification": "NOT_ASSESSED",
                }
                # Describe metadata determines whether a WHERE population query is supported.
                # Classic encrypted fields are also excluded when older metadata lacks this flag.
                if f.get("filterable") is False or f.get("type") == "encryptedstring":
                    skipped.update({"stage": "population", "reason": "Salesforce does not allow filtering this field; population could not be assessed."})
                    skipped_fields.append(skipped)
                    obj_skipped.append(skipped)
                    continue
                stage = "population"
                try:
                    pop_count = self.usage.get_populated_records(obj_name, f_name)
                    usage_pct = self.usage.calculate_usage(total_records, pop_count)
                    stage = "references"
                    ref_res = self.scanner.scan_all_references(obj_name, f_name)
                except Exception as e:
                    skipped.update({"stage": stage, "reason": str(e)})
                    skipped_fields.append(skipped)
                    obj_skipped.append(skipped)
                    logger.warning(f"Could not assess {obj_name}.{f_name} ({stage}): {e}")
                    continue
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
                    item["warning"] = f"{usage_pct}% populated, but referenced in Salesforce code or flows!"
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
                "skipped_count": len(obj_skipped),
            }

        return {
            "threshold_percentage": threshold_percentage,
            "scan_timestamp": datetime.now(timezone.utc).isoformat(),
            "objects_scanned": object_names,
            "total_objects_scanned": len(object_names),
            "total_custom_fields_scanned": len(candidates) + len(needs_review) + len(active_fields),
            "total_custom_fields_discovered": total_custom_fields,
            "total_candidates_found": len(candidates),
            "total_needs_review": len(needs_review),
            "total_active_in_use": len(active_fields),
            "breakdown_by_object": breakdown_by_object,
            "candidates": candidates,
            "needs_review": needs_review,
            "active_fields": active_fields,
            "total_skipped_fields": len(skipped_fields),
            "skipped_fields": skipped_fields,
            "object_errors": object_errors,
            "partial_scan": bool(skipped_fields or object_errors),
        }
