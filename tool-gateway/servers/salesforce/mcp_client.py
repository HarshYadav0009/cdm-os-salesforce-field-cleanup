import sys

from fastmcp import Client
from fastmcp.client.transports import StdioTransport


class SalesforceMCPClient:

    def _create_transport(self):

        return StdioTransport(
            command=sys.executable,
            args=[
                "-m",
                "servers.salesforce.server"
            ],
        )

    async def _call_tool(
        self,
        tool_name: str,
        arguments: dict
    ):

        transport = self._create_transport()

        async with Client(transport) as client:

            result = await client.call_tool(
                tool_name,
                arguments
            )

            if result.is_error:
                raise RuntimeError(
                    f"MCP tool '{tool_name}' failed: "
                    f"{result}"
                )

            # FastMCP 4.x provides structured
            # tool output through .data
            if result.data is not None:
                return result.data

            # Fallback if structured data
            # is unavailable
            return result


    async def list_tools(self):

        transport = self._create_transport()

        async with Client(transport) as client:

            return await client.list_tools()


    async def health_check(self):

        return await self._call_tool(
            "salesforce_health_check",
            {}
        )


    async def describe_object(
        self,
        object_name: str
    ):

        return await self._call_tool(
            "salesforce_describe_object",
            {
                "object_name": object_name
            }
        )


    async def query_field_usage(
        self,
        object_name: str,
        field_name: str
    ):

        return await self._call_tool(
            "salesforce_query_field_usage",
            {
                "object_name": object_name,
                "field_name": field_name
            }
        )