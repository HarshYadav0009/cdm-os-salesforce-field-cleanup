from .field_usage import SalesforceFieldUsageService


def main():

    print("Starting Salesforce field usage analysis...")
    print()

    service = SalesforceFieldUsageService()

    result = service.query_field_usage(
    "Account",
    "Legacy_Cleanup_Test__c"
     )

    print("Field Usage Result")
    print("==================")

    print(
        f"Object: "
        f"{result['object']}"
    )

    print(
        f"Field: "
        f"{result['field']}"
    )

    print(
        f"Total records: "
        f"{result['total_records']}"
    )

    print(
        f"Populated records: "
        f"{result['populated_records']}"
    )

    print(
        f"Usage percentage: "
        f"{result['usage_percentage']}%"
    )

    print(
        f"Zero usage candidate: "
        f"{result['zero_usage_candidate']}"
    )


if __name__ == "__main__":
    main()