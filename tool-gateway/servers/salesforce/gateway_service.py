import asyncio

from .mcp_client import SalesforceMCPClient


class SalesforceToolGatewayService:

    ALLOWED_TOOLS = {
        "salesforce_health_check",
        "salesforce_describe_object",
        "salesforce_query_field_usage"
    }

    def __init__(self):
        self.client = SalesforceMCPClient()

    async def execute(
        self,
        tool_name: str,
        arguments: dict
    ):
        if tool_name not in self.ALLOWED_TOOLS:
            raise ValueError(
                f"Tool is not allowed: {tool_name}"
            )

        if arguments is None:
            arguments = {}

        if tool_name == "salesforce_health_check":
            return await self.client.health_check()

        if tool_name == "salesforce_describe_object":
            object_name = arguments.get("object_name")
            if not object_name:
                raise ValueError("object_name is required")
            return await self.client.describe_object(object_name)

        if tool_name == "salesforce_query_field_usage":
            object_name = arguments.get("object_name")
            field_name = arguments.get("field_name")
            if not object_name:
                raise ValueError("object_name is required")
            if not field_name:
                raise ValueError("field_name is required")
            return await self.client.query_field_usage(
                object_name,
                field_name
            )

        raise ValueError(f"Unsupported tool: {tool_name}")