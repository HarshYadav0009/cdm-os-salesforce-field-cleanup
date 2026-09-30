import asyncio

from .mcp_client import SalesforceMCPClient


async def main():

    client = SalesforceMCPClient()

    print()
    print("SALESFORCE MCP CLIENT TEST")
    print("==========================")
    print()

    print("1. Health Check")
    print("----------------")

    health = await client.health_check()

    print(health)
    print()

    print("2. Account Metadata")
    print("-------------------")

    metadata = await client.describe_object(
        "Account"
    )

    print(
        f"Object: {metadata['object']}"
    )

    print(
        f"Fields returned: "
        f"{len(metadata['fields'])}"
    )

    print()

    print("3. Field Usage")
    print("---------------")

    usage = await client.query_field_usage(
        "Account",
        "Legacy_Cleanup_Test__c"
    )

    print(usage)

    print()
    print("PHASE 11 TEST COMPLETE")


if __name__ == "__main__":
    asyncio.run(main())