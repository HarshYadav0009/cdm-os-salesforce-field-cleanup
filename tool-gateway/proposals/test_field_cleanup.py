from .field_cleanup import FieldCleanupProposalBuilder


def main():

    usage_result = {
        "object": "Account",
        "field": "Legacy_Cleanup_Test__c",
        "total_records": 100,
        "populated_records": 0,
        "usage_percentage": 0.0,
        "zero_usage_candidate": True
    }

    metadata_result = {
        "object": "Account",
        "label": "Account",
        "custom": False,
        "fields": [
            {
                "name": "Legacy_Cleanup_Test__c",
                "label": "Legacy Cleanup Test",
                "type": "textarea",
                "custom": True
            }
        ]
    }

    builder = FieldCleanupProposalBuilder()

    proposal = builder.build(
        usage_result,
        metadata_result
    )

    print("FIELD CLEANUP PROPOSAL")
    print("======================")

    print()

    print(
        f"Proposal ID: "
        f"{proposal['proposal_id']}"
    )

    print(
        f"Proposal Type: "
        f"{proposal['proposal_type']}"
    )

    print()

    print("Resource:")
    print(
        f"  Object: "
        f"{proposal['resource']['object']}"
    )

    print(
        f"  Field: "
        f"{proposal['resource']['field']}"
    )

    print()

    print("Evidence:")

    print(
        f"  Total records: "
        f"{proposal['evidence']['total_records']}"
    )

    print(
        f"  Populated records: "
        f"{proposal['evidence']['populated_records']}"
    )

    print(
        f"  Usage: "
        f"{proposal['evidence']['usage_percentage']}%"
    )

    print(
        f"  Zero usage candidate: "
        f"{proposal['evidence']['zero_usage_candidate']}"
    )

    print()

    print("Action:")

    print(
        f"  Type: "
        f"{proposal['action']['type']}"
    )

    print(
        f"  Destructive: "
        f"{proposal['action']['destructive']}"
    )

    print()

    print("Approval:")

    print(
        f"  Required: "
        f"{proposal['approval']['required']}"
    )

    print(
        f"  Status: "
        f"{proposal['approval']['status']}"
    )


if __name__ == "__main__":
    main()