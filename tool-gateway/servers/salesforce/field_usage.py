from .client import SalesforceClient
from .validators import validate_salesforce_identifier


class SalesforceFieldUsageService:

    def __init__(self, client=None):

        self.client = (
            client
            if client is not None
            else SalesforceClient()
        )

    # ============================================================
    # TOTAL RECORD COUNT
    # ============================================================

    def get_total_records(
        self,
        object_name: str
    ) -> int:

        object_name = validate_salesforce_identifier(
            object_name
        )

        query = (
            f"SELECT COUNT(Id) total "
            f"FROM {object_name}"
        )

        result = self.client.query(query)

        return int(
            result.get("totalSize", 0)
        )

    # ============================================================
    # POPULATED FIELD COUNT
    # ============================================================

    def get_populated_records(
        self,
        object_name: str,
        field_name: str
    ) -> int:

        object_name = validate_salesforce_identifier(
            object_name
        )

        field_name = validate_salesforce_identifier(
            field_name
        )

        query = (
            f"SELECT COUNT(Id) populated "
            f"FROM {object_name} "
            f"WHERE {field_name} != NULL"
        )

        result = self.client.query(query)

        records = result.get(
            "records",
            []
        )

        if not records:
            return 0

        return int(
            records[0].get(
                "populated",
                0
            )
        )

    # ============================================================
    # USAGE PERCENTAGE
    # ============================================================

    def calculate_usage(
        self,
        total_records: int,
        populated_records: int
    ) -> float:

        if total_records <= 0:
            return 0.0

        percentage = (
            populated_records
            / total_records
        ) * 100

        return round(
            percentage,
            2
        )

    # ============================================================
    # COMPLETE FIELD USAGE ANALYSIS
    # ============================================================

    def query_field_usage(
        self,
        object_name: str,
        field_name: str
    ) -> dict:

        object_name = validate_salesforce_identifier(
            object_name
        )

        field_name = validate_salesforce_identifier(
            field_name
        )

        total_records = (
            self.get_total_records(
                object_name
            )
        )

        populated_records = (
            self.get_populated_records(
                object_name,
                field_name
            )
        )

        usage_percentage = (
            self.calculate_usage(
                total_records,
                populated_records
            )
        )

        return {
            "object": object_name,
            "field": field_name,
            "total_records": total_records,
            "populated_records": populated_records,
            "usage_percentage": usage_percentage,
            "zero_usage_candidate": (
                populated_records == 0
            )
        }