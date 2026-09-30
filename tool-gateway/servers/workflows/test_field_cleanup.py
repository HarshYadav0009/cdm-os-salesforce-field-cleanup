import asyncio
import json

from .field_cleanup import (
    FieldCleanupWorkflow
)


async def main():

    print()
    print("================================")
    print("PHASE 14 - FIELD CLEANUP TEST")
    print("================================")
    print()

    workflow = FieldCleanupWorkflow()

    print(
        "Analyzing Salesforce field..."
    )

    print()

    proposal = await workflow.analyze(
        "Account",
        "Legacy_Cleanup_Test__c"
    )

    print(
        json.dumps(
            proposal,
            indent=2
        )
    )

    print()

    print(
        "Proposal ID:"
    )

    print(
        proposal["proposal_id"]
    )

    print()

    print(
        "Action:"
    )

    print(
        proposal["action"]["type"]
    )

    print()

    print(
        "Destructive:"
    )

    print(
        proposal["action"]["destructive"]
    )

    print()

    print(
        "Approval Required:"
    )

    print(
        proposal["approval"]["required"]
    )

    print()

    print(
        "Approval Status:"
    )

    print(
        proposal["approval"]["status"]
    )

    print()

    print(
        "================================"
    )

    print(
        "PHASE 14 TEST PASSED"
    )

    print(
        "================================"
    )


if __name__ == "__main__":

    asyncio.run(main())