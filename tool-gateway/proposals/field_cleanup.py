class FieldCleanupProposalBuilder:

    def build(
        self,
        usage_result: dict,
        metadata_result: dict,
        agent_id: str = "field-cleanup-agent",
        tool_id: str = "salesforce_query_field_usage",
    ) -> dict:
        """
        Build a proposal payload compatible with
        Control Plane POST /api/v1/proposals/.
        """
        if not usage_result:
            raise ValueError("usage_result is required")
        if not metadata_result:
            raise ValueError("metadata_result is required")

        object_name = usage_result.get("object")
        field_name = usage_result.get("field")
        if not object_name:
            raise ValueError("Usage result does not contain object")
        if not field_name:
            raise ValueError("Usage result does not contain field")

        field_metadata = None
        for field in metadata_result.get("fields", []):
            if field.get("name") == field_name:
                field_metadata = field
                break

        if field_metadata is None:
            raise ValueError(
                f"Field {field_name} was not found in metadata"
            )

        return {
            "agent_id": agent_id,
            "tool_id": tool_id,
            "input_payload": {
                "proposal_type": "FIELD_CLEANUP",
                "object_api_name": object_name,
                "field_api_name": field_name,
                "field_label": field_metadata.get("label"),
                "field_type": field_metadata.get("type"),
                "is_custom": field_metadata.get("custom"),
                "total_records": usage_result.get("total_records", 0),
                "populated_records": usage_result.get("populated_records", 0),
                "usage_percentage": usage_result.get("usage_percentage", 0.0),
                "zero_usage_candidate": usage_result.get("zero_usage_candidate", False),
                "action": "REVIEW_FOR_DELETION",
            }
        }