from proposals.field_cleanup import (
    FieldCleanupProposalBuilder
)

from servers.salesforce.mcp_client import (
    SalesforceMCPClient
)


class FieldCleanupWorkflow:

    def __init__(self):

        self.salesforce = (
            SalesforceMCPClient()
        )

        self.proposal_builder = (
            FieldCleanupProposalBuilder()
        )


    async def analyze(
        self,
        object_name: str,
        field_name: str
    ) -> dict:

        metadata = await (
            self.salesforce.describe_object(
                object_name
            )
        )

        usage = await (
            self.salesforce.query_field_usage(
                object_name,
                field_name
            )
        )

        proposal = (
            self.proposal_builder.build(
                usage,
                metadata
            )
        )

        return proposal