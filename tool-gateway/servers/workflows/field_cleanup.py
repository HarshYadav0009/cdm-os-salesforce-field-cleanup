from typing import Dict, Any, Optional
from proposals.field_cleanup import FieldCleanupProposalBuilder
from servers.salesforce.mcp_client import SalesforceMCPClient
from knowledge.precedents.precedent_store import PrecedentStore


class FieldCleanupWorkflow:
    """
    End-to-End Field Cleanup Analysis Workflow.
    """

    def __init__(
        self,
        salesforce_client: Optional[SalesforceMCPClient] = None,
        proposal_builder: Optional[FieldCleanupProposalBuilder] = None,
        precedent_store: Optional[PrecedentStore] = None,
    ):
        self.salesforce = salesforce_client or SalesforceMCPClient()
        self.proposal_builder = proposal_builder or FieldCleanupProposalBuilder()
        self.precedent_store = precedent_store or PrecedentStore()

    async def analyze(
        self,
        object_name: str,
        field_name: str
    ) -> Dict[str, Any]:
        metadata = await self.salesforce.describe_object(object_name)
        usage = await self.salesforce.query_field_usage(object_name, field_name)
        references = await self.salesforce.scan_apex_references(object_name, field_name)
        precedent_check = self.precedent_store.check_applicability(object_name, field_name)

        proposal = self.proposal_builder.build(
            usage_result=usage,
            metadata_result=metadata,
            reference_result=references,
            precedent_result=precedent_check
        )

        return proposal