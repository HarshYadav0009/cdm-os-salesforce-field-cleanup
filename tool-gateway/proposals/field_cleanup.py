from uuid import uuid4


class FieldCleanupProposalBuilder:

    def build(
        self,
        usage_result: dict,
        metadata_result: dict
    ) -> dict:

        if not usage_result:
            raise ValueError(
                "usage_result is required"
            )

        if not metadata_result:
            raise ValueError(
                "metadata_result is required"
            )

        object_name = usage_result.get(
            "object"
        )

        field_name = usage_result.get(
            "field"
        )

        if not object_name:
            raise ValueError(
                "Usage result does not contain object"
            )

        if not field_name:
            raise ValueError(
                "Usage result does not contain field"
            )

        field_metadata = None

        for field in metadata_result.get(
            "fields",
            []
        ):

            if field.get("name") == field_name:

                field_metadata = field

                break

        if field_metadata is None:

            raise ValueError(
                f"Field {field_name} "
                f"was not found in metadata"
            )

        return {

            "proposal_id": str(uuid4()),

            "proposal_type":
                "FIELD_CLEANUP",

            "resource": {
                "object": object_name,
                "field": field_name
            },

            "field": {
                "name": field_name,
                "label": field_metadata.get(
                    "label"
                ),
                "type": field_metadata.get(
                    "type"
                ),
                "custom": field_metadata.get(
                    "custom"
                )
            },

            "evidence": {
                "total_records":
                    usage_result.get(
                        "total_records",
                        0
                    ),

                "populated_records":
                    usage_result.get(
                        "populated_records",
                        0
                    ),

                "usage_percentage":
                    usage_result.get(
                        "usage_percentage",
                        0.0
                    ),

                "zero_usage_candidate":
                    usage_result.get(
                        "zero_usage_candidate",
                        False
                    )
            },

            "action": {
                "type":
                    "REVIEW_FOR_DELETION",

                "destructive":
                    False
            },

            "approval": {
                "required":
                    True,

                "status":
                    "PENDING"
            },

            "status":
                "PROPOSED"
        }