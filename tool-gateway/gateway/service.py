import os
import sys
import logging
from typing import Dict, Any, List, Optional

# Ensure servers path is discoverable
server_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "servers")
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

from servers.salesforce.mcp_client import SalesforceMCPClient
from servers.salesforce.validators import validate_tool_payload

logger = logging.getLogger("tool_gateway.service")


class ToolGatewayService:
    """
    Central Tool Gateway Service.
    Enforces payload validation, routes calls to MCP servers, and isolates tool execution.
    """

    def __init__(self, salesforce_client: Optional[SalesforceMCPClient] = None):
        self.salesforce = salesforce_client or SalesforceMCPClient()

    async def health_check(self) -> Dict[str, Any]:
        return await self.salesforce.health_check()

    async def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "tool_id": "salesforce_describe_global",
                "name": "Describe Global Objects",
                "description": "List all SObjects in the Salesforce org",
                "tier": "Tier-1",
            },
            {
                "tool_id": "salesforce_describe_object",
                "name": "Describe SObject",
                "description": "Get field-level metadata for a specific SObject",
                "tier": "Tier-1",
            },
            {
                "tool_id": "salesforce_get_field_metadata",
                "name": "Get Field Metadata",
                "description": "Retrieve comprehensive metadata for a specific field",
                "tier": "Tier-1",
            },
            {
                "tool_id": "salesforce_query_field_usage",
                "name": "Query Field Usage",
                "description": "Run SOQL to compute field population %",
                "tier": "Tier-1",
            },
            {
                "tool_id": "salesforce_scan_apex_references",
                "name": "Scan Apex References",
                "description": "Search Apex classes, triggers, flows for field API name references",
                "tier": "Tier-1",
            },
            {
                "tool_id": "salesforce_backup_field_definition",
                "name": "Backup Field Definition",
                "description": "Export immutable field metadata XML/JSON snapshot before modification",
                "tier": "Tier-2",
            },
            {
                "tool_id": "salesforce_deprecate_field",
                "name": "Deprecate Field",
                "description": "Back up and mark a custom field description as deprecated; leaves field access unchanged",
                "tier": "Tier-2",
            },
            {
                "tool_id": "salesforce_delete_field",
                "name": "Delete Custom Field",
                "description": "Back up and delete an unmanaged custom field after human approval",
                "tier": "Tier-3",
            },
            {
                "tool_id": "salesforce_rollback_field",
                "name": "Rollback Field",
                "description": "Roll back a modified field to original state using backup ID",
                "tier": "Tier-2",
            },
            {
                "tool_id": "salesforce_bulk_scan",
                "name": "Bulk Scan SObjects",
                "description": "Execute bulk usage and reference scanning across all custom SObjects",
                "tier": "Tier-1",
            },
        ]

    async def describe_global(self) -> Dict[str, Any]:
        return await self.salesforce.describe_global()

    async def describe_object(self, object_name: str) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_describe_object", {"object_name": object_name})
        return await self.salesforce.describe_object(validated["object_name"])

    async def get_field_metadata(self, object_name: str, field_name: str) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_get_field_metadata", {
            "object_name": object_name,
            "field_name": field_name
        })
        return await self.salesforce.get_field_metadata(validated["object_name"], validated["field_name"])

    async def query_field_usage(self, object_name: str, field_name: str) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_query_field_usage", {
            "object_name": object_name,
            "field_name": field_name
        })
        return await self.salesforce.query_field_usage(validated["object_name"], validated["field_name"])

    async def scan_apex_references(self, object_name: str, field_name: str) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_scan_apex_references", {
            "object_name": object_name,
            "field_name": field_name
        })
        return await self.salesforce.scan_apex_references(validated["object_name"], validated["field_name"])

    async def backup_field_definition(self, object_name: str, field_name: str) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_backup_field_definition", {
            "object_name": object_name,
            "field_name": field_name
        })
        return await self.salesforce.backup_field_definition(validated["object_name"], validated["field_name"])

    async def deprecate_field(
        self,
        object_name: str,
        field_name: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_deprecate_field", {
            "object_name": object_name,
            "field_name": field_name,
            "reason": reason
        })
        return await self.salesforce.deprecate_field(
            validated["object_name"],
            validated["field_name"],
            validated.get("reason")
        )

    async def delete_field(
        self,
        object_name: str,
        field_name: str,
        confirm_delete: bool,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_delete_field", {
            "object_name": object_name,
            "field_name": field_name,
            "confirm_delete": confirm_delete,
            "reason": reason,
        })
        return await self.salesforce.delete_field(
            validated["object_name"],
            validated["field_name"],
            validated["confirm_delete"],
            validated.get("reason"),
        )

    async def rollback_field(self, backup_id: str) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_rollback_field", {"backup_id": backup_id})
        return await self.salesforce.rollback_field(validated["backup_id"])

    async def bulk_scan(
        self,
        object_names: Optional[List[str]] = None,
        threshold_percentage: float = 0.0
    ) -> Dict[str, Any]:
        validated = validate_tool_payload("salesforce_bulk_scan", {
            "object_names": object_names,
            "threshold_percentage": threshold_percentage
        })
        return await self.salesforce.bulk_scan(
            validated.get("object_names"),
            validated.get("threshold_percentage", 0.0)
        )

    async def execute_tool(self, tool_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Universal governed tool invocation.
        Applies input validation and executes through isolated handler.
        """
        if tool_name == "salesforce_health_check":
            return await self.health_check()
        elif tool_name == "salesforce_describe_global":
            return await self.describe_global()
        elif tool_name == "salesforce_describe_object":
            return await self.describe_object(payload.get("object_name", ""))
        elif tool_name == "salesforce_get_field_metadata":
            return await self.get_field_metadata(payload.get("object_name", ""), payload.get("field_name", ""))
        elif tool_name == "salesforce_query_field_usage":
            return await self.query_field_usage(payload.get("object_name", ""), payload.get("field_name", ""))
        elif tool_name == "salesforce_scan_apex_references":
            return await self.scan_apex_references(payload.get("object_name", ""), payload.get("field_name", ""))
        elif tool_name == "salesforce_backup_field_definition":
            return await self.backup_field_definition(payload.get("object_name", ""), payload.get("field_name", ""))
        elif tool_name == "salesforce_deprecate_field":
            return await self.deprecate_field(
                payload.get("object_name", ""),
                payload.get("field_name", ""),
                payload.get("reason")
            )
        elif tool_name == "salesforce_delete_field":
            return await self.delete_field(
                payload.get("object_name", ""),
                payload.get("field_name", ""),
                payload.get("confirm_delete", False),
                payload.get("reason"),
            )
        elif tool_name == "salesforce_rollback_field":
            return await self.rollback_field(payload.get("backup_id", ""))
        elif tool_name == "salesforce_bulk_scan":
            return await self.bulk_scan(
                payload.get("object_names"),
                payload.get("threshold_percentage", 0.0)
            )
        else:
            raise ValueError(f"Unknown or unauthorized tool: '{tool_name}'")