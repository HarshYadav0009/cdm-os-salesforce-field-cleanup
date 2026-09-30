import asyncio
import json

from .field_analyzer import FieldAnalyzer


async def main():

    print()
    print("================================")
    print("PHASE 13 - AGENT RUNTIME TEST")
    print("================================")
    print()


    analyzer = FieldAnalyzer()


    # -----------------------------------------
    # 1. Health check
    # -----------------------------------------

    print("1. Checking Tool Gateway...")
    print()

    health = await (
        analyzer.tools.health_check()
    )

    print(
        json.dumps(
            health,
            indent=2
        )
    )

    print()


    # -----------------------------------------
    # 2. Analyze field
    # -----------------------------------------

    print(
        "2. Analyzing Salesforce field..."
    )

    print()

    result = await analyzer.analyze_field(
        "Account",
        "Legacy_Cleanup_Test__c"
    )


    # -----------------------------------------
    # 3. Display metadata
    # -----------------------------------------

    field = result[
        "field_metadata"
    ]

    print(
        "Field Metadata"
    )

    print(
        "--------------"
    )

    print(
        f"Object: "
        f"{result['object']}"
    )

    print(
        f"Field: "
        f"{result['field']}"
    )

    print(
        f"Label: "
        f"{field.get('label')}"
    )

    print(
        f"Type: "
        f"{field.get('type')}"
    )

    print(
        f"Custom: "
        f"{field.get('custom')}"
    )

    print()


    # -----------------------------------------
    # 4. Display usage
    # -----------------------------------------

    usage = result[
        "usage"
    ]

    print(
        "Field Usage"
    )

    print(
        "-----------"
    )

    print(
        f"Total records: "
        f"{usage['total_records']}"
    )

    print(
        f"Populated records: "
        f"{usage['populated_records']}"
    )

    print(
        f"Usage percentage: "
        f"{usage['usage_percentage']}%"
    )

    print(
        f"Zero usage candidate: "
        f"{usage['zero_usage_candidate']}"
    )

    print()


    # -----------------------------------------
    # 5. Display complete result
    # -----------------------------------------

    print(
        "Complete Analysis"
    )

    print(
        "-----------------"
    )

    print(
        json.dumps(
            result,
            indent=2
        )
    )

    print()

    print(
        "================================"
    )

    print(
        "PHASE 13 TEST PASSED"
    )

    print(
        "================================"
    )


if __name__ == "__main__":

    asyncio.run(main())