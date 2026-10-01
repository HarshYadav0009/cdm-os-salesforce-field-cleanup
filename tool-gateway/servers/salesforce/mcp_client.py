import sys
import asyncio
import logging
import os

from fastmcp import Client
from fastmcp.client.transports import StdioTransport

logger = logging.getLogger("cdm.mcp_client")

MCP_TIMEOUT = int(os.getenv("MCP_REQUEST_TIMEOUT_SEC", "30"))
MCP_MAX_RETRIES = int(os.getenv("MCP_MAX_RETRIES", "2"))


class SalesforceMCPClient:

    def _create_transport(self):
        return StdioTransport(
            command=sys.executable,
            args=["-m", "servers.salesforce.server"],
        )

    async def _call_tool(
        self,
        tool_name: str,
        arguments: dict,
        retries: int = MCP_MAX_RETRIES,
    ):
        last_error = None

        for attempt in range(1, retries + 1):
            transport = self._create_transport()
            try:
                async with asyncio.timeout(MCP_TIMEOUT):
                    async with Client(transport) as client:
                        result = await client.call_tool(
                            tool_name, arguments
                        )

                if result.is_error:
                    raise RuntimeError(
                        f"MCP tool '{tool_name}' failed: {result}"
                    )

                if result.data is not None:
                    return result.data
                return result

            except asyncio.TimeoutError:
                last_error = TimeoutError(
                    f"MCP tool '{tool_name}' timed out "
                    f"after {MCP_TIMEOUT}s (attempt {attempt}/{retries})"
                )
                logger.warning(str(last_error))

            except Exception as exc:
                last_error = exc
                logger.warning(
                    f"MCP tool '{tool_name}' error on attempt "
                    f"{attempt}/{retries}: {exc}"
                )

            if attempt < retries:
                wait = 2 ** (attempt - 1)
                logger.info(f"Retrying in {wait}s...")
                await asyncio.sleep(wait)

        raise RuntimeError(
            f"MCP tool '{tool_name}' failed after {retries} attempts"
        ) from last_error

    async def list_tools(self):
        transport = self._create_transport()
        async with asyncio.timeout(MCP_TIMEOUT):
            async with Client(transport) as client:
                return await client.list_tools()

    async def health_check(self):
        return await self._call_tool(
            "salesforce_health_check", {}
        )

    async def describe_object(self, object_name: str):
        return await self._call_tool(
            "salesforce_describe_object",
            {"object_name": object_name},
        )

    async def query_field_usage(
        self, object_name: str, field_name: str
    ):
        return await self._call_tool(
            "salesforce_query_field_usage",
            {"object_name": object_name, "field_name": field_name},
        )

    async def scan_apex_references(
        self, object_name: str, field_name: str
    ):
        return await self._call_tool(
            "salesforce_scan_apex_references",
            {"object_name": object_name, "field_name": field_name},
        )

    async def full_field_assessment(
        self, object_name: str, field_name: str
    ):
        return await self._call_tool(
            "salesforce_full_field_assessment",
            {"object_name": object_name, "field_name": field_name},
        )
