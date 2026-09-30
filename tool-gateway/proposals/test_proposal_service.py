import asyncio

from proposals.proposal_service import (
    ProposalService
)


async def main():

    service = ProposalService()

    proposal = {
        "proposal_id":
            "phase15-test",

        "proposal_type":
            "FIELD_CLEANUP",

        "resource": {
            "object":
                "Account",

            "field":
                "Legacy_Cleanup_Test__c"
        },

        "evidence": {
            "total_records":
                1,

            "populated_records":
                0,

            "usage_percentage":
                0.0,

            "zero_usage_candidate":
                True
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

    result = await service.submit_proposal(
        proposal=proposal,
        agent_id="field-cleanup-agent",
        tool_id="salesforce_query_field_usage"
    )

    print()
    print("=" * 60)
    print("CONTROL PLANE RESPONSE")
    print("=" * 60)
    print(result)
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())