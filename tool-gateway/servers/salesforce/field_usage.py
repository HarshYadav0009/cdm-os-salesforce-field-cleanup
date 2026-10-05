import logging
from typing import Dict, Any, List, Optional

from .client import SalesforceClient
from .validators import validate_salesforce_identifier

logger = logging.getLogger("salesforce.field_usage")


class SalesforceFieldUsageService:
    """
    Salesforce Field Population and Usage Analysis Service.
    Executes governed read-only SOQL queries to calculate record counts and population ratios.
    """

    def __init__(self, client: Optional[SalesforceClient] = None):
        self.client = client if client is not None else SalesforceClient()

    # ============================================================
    # TOTAL RECORD COUNT
    # ============================================================

    def get_total_records(self, object_name: str) -> int:
        """Get the total count of records for an SObject."""
        object_name = validate_salesforce_identifier(object_name)
        query = f"SELECT COUNT(Id) total FROM {object_name}"
        result = self.client.query(query)

        records = result.get("records", [])
        if records and "total" in records[0]:
            return int(records[0]["total"])

        return int(result.get("totalSize", 0))

    # ============================================================
    # POPULATED FIELD COUNT
    # ============================================================

    def get_populated_records(self, object_name: str, field_name: str) -> int:
        """Count records where the specified field is populated (non-null)."""
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        query = (
            f"SELECT COUNT(Id) populated "
            f"FROM {object_name} "
            f"WHERE {field_name} != NULL"
        )

        result = self.client.query(query)
        records = result.get("records", [])

        if not records:
            return 0

        return int(records[0].get("populated", 0))

    # ============================================================
    # USAGE PERCENTAGE
    # ============================================================

    def calculate_usage(self, total_records: int, populated_records: int) -> float:
        """Calculate field population percentage (0.00% to 100.00%)."""
        if total_records <= 0:
            return 0.0

        percentage = (populated_records / total_records) * 100
        return round(percentage, 2)

    # ============================================================
    # COMPLETE FIELD USAGE ANALYSIS
    # ============================================================

    def query_field_usage(self, object_name: str, field_name: str) -> Dict[str, Any]:
        """
        Analyze Salesforce field population.
        Identifies whether a field has zero populated records.
        NOTE: A field with zero populated records is NOT automatically safe to delete;
        Apex/Flow references must still be checked.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        total_records = self.get_total_records(object_name)
        populated_records = self.get_populated_records(object_name, field_name)
        usage_percentage = self.calculate_usage(total_records, populated_records)

        return {
            "object": object_name,
            "field": field_name,
            "total_records": total_records,
            "populated_records": populated_records,
            "usage_percentage": usage_percentage,
            "zero_usage_candidate": (populated_records == 0),
            "recommendation_hint": (
                "Candidate for deprecation (0% population) - check references before deletion"
                if populated_records == 0
                else f"In use ({usage_percentage}% populated) - retain"
            )
        }

    # ============================================================
    # BULK OBJECT ANALYSIS
    # ============================================================

    def analyze_object_custom_fields(self, object_name: str, custom_fields: List[str]) -> List[Dict[str, Any]]:
        """Analyze usage for all supplied custom fields on an object."""
        object_name = validate_salesforce_identifier(object_name)
        total_records = self.get_total_records(object_name)

        results = []
        for field_name in custom_fields:
            field_name = validate_salesforce_identifier(field_name)
            populated = self.get_populated_records(object_name, field_name)
            usage = self.calculate_usage(total_records, populated)
            results.append({
                "object": object_name,
                "field": field_name,
                "total_records": total_records,
                "populated_records": populated,
                "usage_percentage": usage,
                "zero_usage_candidate": (populated == 0)
            })

        return results