import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():

    server_params = StdioServerParameters(
        command="python",
        args=["server.py"],
    )

    async with stdio_client(server_params) as (read, write):

        async with ClientSession(read, write) as session:

            await session.initialize()

            tools = await session.list_tools()

            print("\nAvailable MCP tools:")

            for tool in tools.tools:
                print(f"- {tool.name}")

            print("\nCalling health_check...\n")

            result = await session.call_tool(
                "health_check",
                {}
            )

            print(result)


            # this section is used for salesforce interaction (mcp-salesforce) 
            print("\nCalling get_object_metadata...\n")

            result = await session.call_tool(
                "get_object_metadata",
                {
                    "object_name": "Account"
                }
            )

            print(result)

            


if __name__ == "__main__":
    asyncio.run(main())