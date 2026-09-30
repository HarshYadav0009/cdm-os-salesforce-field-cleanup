from tools.tool_gateway_client import (
    ToolGatewayClient
)


class FieldAnalyzer:

    def __init__(
        self,
        tool_gateway=None
    ):

        self.tools = (
            tool_gateway
            if tool_gateway is not None
            else ToolGatewayClient()
        )


    async def analyze_field(
        self,
        object_name: str,
        field_name: str
    ) -> dict:

        if not object_name:
            raise ValueError(
                "object_name is required"
            )

        if not field_name:
            raise ValueError(
                "field_name is required"
            )


        # -----------------------------------------
        # 1. Get Salesforce metadata
        # -----------------------------------------

        metadata = await (
            self.tools.describe_object(
                object_name
            )
        )


        # -----------------------------------------
        # 2. Get field usage
        # -----------------------------------------

        usage = await (
            self.tools.field_usage(
                object_name,
                field_name
            )
        )


        # -----------------------------------------
        # 3. Verify field exists
        # -----------------------------------------

        field_metadata = None

        for field in metadata.get(
            "fields",
            []
        ):

            if field.get("name") == field_name:

                field_metadata = field
                break


        if field_metadata is None:

            raise ValueError(
                f"Field {field_name} "
                f"was not found on "
                f"{object_name}"
            )


        # -----------------------------------------
        # 4. Return normalized analysis
        # -----------------------------------------

        return {

            "object": object_name,

            "field": field_name,

            "field_metadata": field_metadata,

            "usage": usage

        }