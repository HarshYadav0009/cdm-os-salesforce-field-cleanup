import sys
from typing import Dict, Any, List, Optional
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

logger = logging.getLogger("cdm.mcp_client")

MCP_TIMEOUT = int(os.getenv("MCP_REQUEST_TIMEOUT_SEC", "30"))
MCP_MAX_RETRIES = int(os.getenv("MCP_MAX_RETRIES", "2"))


class SalesforceMCPClient:
    """
    Client interface for Salesforce MCP Server.
    Communicates with FastMCP server over standard I/O transport.
    """

    def _create_transport(self):
        return StdioTransport(
            command=sys.executable,
            args=["-m", "servers.salesforce.server"],
        )

    async def _call_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> Any:
        transport = self._create_transport()
        async with Client(transport) as client:
            result = await client.call_tool(
                tool_name,
                arguments
            )
            if result.is_error:
                raise RuntimeError(
                    f"MCP tool '{tool_name}' failed: {result}"
                )
            if result.data is not None:
                return result.data
            return result

    async def list_tools(self):
        transport = self._create_transport()
        async with Client(transport) as client:
            return await client.list_tools()

    async def health_check(self) -> Dict[str, Any]:
        return await self._call_tool("salesforce_health_check", {})

    async def describe_global(self) -> Dict[str, Any]:
        return await self._call_tool("salesforce_describe_global", {})

    async def describe_object(self, object_name: str) -> Dict[str, Any]:
        return await self._call_tool("salesforce_describe_object", {"object_name": object_name})

    async def get_field_metadata(self, object_name: str, field_name: str) -> Dict[str, Any]:
        return await self._call_tool(
            "salesforce_get_field_metadata",
            {"object_name": object_name, "field_name": field_name}
        )

    async def query_field_usage(self, object_name: str, field_name: str) -> Dict[str, Any]:
        return await self._call_tool(
            "salesforce_query_field_usage",
            {"object_name": object_name, "field_name": field_name}
        )

    async def scan_apex_references(self, object_name: str, field_name: str) -> Dict[str, Any]:
        return await self._call_tool(
            "salesforce_scan_apex_references",
            {"object_name": object_name, "field_name": field_name}
        )

    async def search_flow(self, field_name: str) -> List[Dict[str, Any]]:
        return await self._call_tool("salesforce_search_flow", {"field_name": field_name})

    async def search_lwc(self, field_name: str) -> List[Dict[str, Any]]:
        return await self._call_tool("salesforce_search_lwc", {"field_name": field_name})

    async def backup_field_definition(self, object_name: str, field_name: str) -> Dict[str, Any]:
        return await self._call_tool(
            "salesforce_backup_field_definition",
            {"object_name": object_name, "field_name": field_name}
        )

    async def deprecate_field(
        self,
        object_name: str,
        field_name: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        return await self._call_tool(
            "salesforce_deprecate_field",
            {"object_name": object_name, "field_name": field_name, "reason": reason}
        )

    async def rollback_field(self, backup_id: str) -> Dict[str, Any]:
        return await self._call_tool("salesforce_rollback_field", {"backup_id": backup_id})

    async def bulk_scan(
        self,
        object_names: Optional[List[str]] = None,
        threshold_percentage: float = 0.0
    ) -> Dict[str, Any]:
        return await self._call_tool(
            "salesforce_bulk_scan",
            {"object_names": object_names, "threshold_percentage": threshold_percentage}
        )