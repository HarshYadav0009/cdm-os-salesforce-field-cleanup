import asyncio
from typing import Dict, Any, Optional

from .mcp_client import SalesforceMCPClient
from .validators import validate_tool_payload


class SalesforceToolGatewayService:
    """
    Synchronous / In-process Gateway Service executing Salesforce MCP tools
    with strict allowed tool list and input payload validation.
    """

    ALLOWED_TOOLS = {
        "salesforce_health_check",
        "salesforce_describe_global",
        "salesforce_describe_object",
        "salesforce_get_field_metadata",
        "salesforce_query_field_usage",
        "salesforce_scan_apex_references",
        "salesforce_search_flow",
        "salesforce_search_lwc",
        "salesforce_backup_field_definition",
        "salesforce_deprecate_field",
        "salesforce_rollback_field",
        "salesforce_bulk_scan",
    }

    def __init__(self, client: Optional[SalesforceMCPClient] = None):
        self.client = client if client is not None else SalesforceMCPClient()

    def execute(self, tool_name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
        """
        Validate and execute an authorized Salesforce tool.
        """
        if tool_name not in self.ALLOWED_TOOLS:
            raise ValueError(f"Tool is not allowed by Tool Gateway policy: '{tool_name}'")

        arguments = arguments or {}

        # Validate input payload schema before execution
        validated_args = validate_tool_payload(tool_name, arguments)

        # Helper to run async client call in sync context
        def _run(coro):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                        return pool.submit(asyncio.run, coro).result()
                else:
                    return loop.run_until_complete(coro)
            except RuntimeError:
                return asyncio.run(coro)

        if tool_name == "salesforce_health_check":
            return _run(self.client.health_check())

        if tool_name == "salesforce_describe_global":
            return _run(self.client.describe_global())

        if tool_name == "salesforce_describe_object":
            return _run(self.client.describe_object(validated_args["object_name"]))

        if tool_name == "salesforce_get_field_metadata":
            return _run(self.client.get_field_metadata(
                validated_args["object_name"],
                validated_args["field_name"]
            ))

        if tool_name == "salesforce_query_field_usage":
            return _run(self.client.query_field_usage(
                validated_args["object_name"],
                validated_args["field_name"]
            ))

        if tool_name == "salesforce_scan_apex_references":
            return _run(self.client.scan_apex_references(
                validated_args["object_name"],
                validated_args["field_name"]
            ))

        if tool_name == "salesforce_search_flow":
            return _run(self.client.search_flow(validated_args.get("field_name", "")))

        if tool_name == "salesforce_search_lwc":
            return _run(self.client.search_lwc(validated_args.get("field_name", "")))

        if tool_name == "salesforce_backup_field_definition":
            return _run(self.client.backup_field_definition(
                validated_args["object_name"],
                validated_args["field_name"]
            ))

        if tool_name == "salesforce_deprecate_field":
            return _run(self.client.deprecate_field(
                validated_args["object_name"],
                validated_args["field_name"],
                validated_args.get("reason")
            ))

        if tool_name == "salesforce_rollback_field":
            return _run(self.client.rollback_field(validated_args["backup_id"]))

        if tool_name == "salesforce_bulk_scan":
            return _run(self.client.bulk_scan(
                validated_args.get("object_names"),
                validated_args.get("threshold_percentage", 0.0)
            ))

        raise ValueError(f"Unsupported tool: '{tool_name}'")