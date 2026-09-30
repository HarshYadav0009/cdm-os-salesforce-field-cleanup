import asyncio
import sys

from fastmcp import Client
from fastmcp.client.transports import StdioTransport


async def main():

    print("Starting Salesforce MCP client...")
    print()

    transport = StdioTransport(
        command=sys.executable,
        args=[
            "-m",
            "servers.salesforce.server"
        ],
    )

    async with Client(transport) as client:

        print("MCP connection established!")
        print()

        # ====================================================
        # LIST TOOLS
        # ====================================================

        tools = await client.list_tools()

        print("Available MCP tools:")
        print("====================")

        for tool in tools:
            print(f"- {tool.name}")

        print()

        # ====================================================
        # HEALTH CHECK
        # ====================================================

        print("Running health check...")
        print()

        health = await client.call_tool(
            "salesforce_health_check",
            {}
        )

        print("Health Check Result:")
        print("====================")
        print(health)
        print()

        # ====================================================
        # OBJECT METADATA
        # ====================================================

        print("Testing Account metadata...")
        print()

        metadata = await client.call_tool(
            "salesforce_describe_object",
            {
                "object_name": "Account"
            }
        )

        print("Metadata Result:")
        print("================")

        print(metadata)
        print()

        # ====================================================
        # FIELD USAGE
        # ====================================================

        print("Testing field usage...")
        print()

        usage = await client.call_tool(
            "salesforce_query_field_usage",
            {
                "object_name": "Account",
                "field_name": "Legacy_Cleanup_Test__c"
            }
        )

        print("Field Usage Result:")
        print("===================")

        print(usage)
        print()


if __name__ == "__main__":
    asyncio.run(main())