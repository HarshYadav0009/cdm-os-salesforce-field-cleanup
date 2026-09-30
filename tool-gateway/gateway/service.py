from servers.salesforce.mcp_client import (
    SalesforceMCPClient
)


class ToolGatewayService:

    def __init__(self):

        self.salesforce = (
            SalesforceMCPClient()
        )

    async def health_check(self):

        return await (
            self.salesforce.health_check()
        )

    async def describe_object(
        self,
        object_name: str
    ):

        return await (
            self.salesforce.describe_object(
                object_name
            )
        )

    async def query_field_usage(
        self,
        object_name: str,
        field_name: str
    ):

        return await (
            self.salesforce.query_field_usage(
                object_name,
                field_name
            )
        )