from typing import Dict, Any, Optional
import logging

from proposals.field_cleanup import FieldCleanupProposalBuilder
from proposals.proposal_service import ProposalService
from servers.salesforce.mcp_client import SalesforceMCPClient
from knowledge.precedents.precedent_store import PrecedentStore

logger = logging.getLogger("cdm.workflow.field_cleanup")


class FieldCleanupWorkflow:
    """
    End-to-End Field Cleanup Analysis Workflow.
    Orchestrates metadata inspection, population usage SOQL, Apex/Flow reference discovery,
    and precedent evaluation into an auditable cleanup proposal.
    After analysis, the proposal is automatically submitted to the Control Plane for
    Policy Engine evaluation and (if required) human approval.
    """

    # Agent ID that must be pre-registered via POST /api/v1/agents
    AGENT_ID = "field-cleanup-agent"

    def __init__(
        self,
        salesforce_client: Optional[SalesforceMCPClient] = None,
        proposal_builder: Optional[FieldCleanupProposalBuilder] = None,
        precedent_store: Optional[PrecedentStore] = None,
        proposal_service: Optional[ProposalService] = None,
    ):
        self.salesforce = salesforce_client or SalesforceMCPClient()
        self.proposal_builder = proposal_builder or FieldCleanupProposalBuilder()
        self.precedent_store = precedent_store or PrecedentStore()
        self.proposal_service = proposal_service or ProposalService()

    def _select_tool_id(self, proposal: Dict[str, Any]) -> str:
        """
        Determine the appropriate tool_id based on the recommended action.
        DELETE actions use the Tier-3 delete tool; everything else uses deprecate (Tier-2).
        """
        recommended = (
            proposal.get("risk_assessment", {}).get("recommended_action", "")
            or ""
        ).upper()
        if "DELETE" in recommended:
            return "salesforce_delete_field"
        return "salesforce_deprecate_field"

    async def analyze(
        self,
        object_name: str,
        field_name: str
    ) -> Dict[str, Any]:
        """
        Execute comprehensive field cleanup analysis and submit the resulting proposal
        to the Control Plane for Policy Engine evaluation.

        Returns the Control Plane submission response (which includes the proposal ID,
        status after policy evaluation, and whether human approval is required).
        """
        # 1. Fetch object metadata
        metadata = await self.salesforce.describe_object(object_name)

        # 2. Compute field population metrics
        usage = await self.salesforce.query_field_usage(object_name, field_name)

        # 3. Scan Apex and Flow dependencies
        references = await self.salesforce.scan_apex_references(object_name, field_name)

        # 4. Check historical precedent memory
        precedent_check = self.precedent_store.check_applicability(object_name, field_name)

        # 5. Build consolidated proposal package
        proposal = self.proposal_builder.build(
            usage_result=usage,
            metadata_result=metadata,
            reference_result=references,
            precedent_result=precedent_check
        )

        # 6. Determine which tool tier is appropriate
        tool_id = self._select_tool_id(proposal)

        # 7. Submit to the Control Plane
        #    The input_payload is the full structured proposal content.
        #    confirm_delete is always False here — only set True after explicit human approval.
        submission_payload = {
            "object_name": object_name,
            "field_name": field_name,
            "reason": proposal.get("risk_assessment", {}).get("recommended_action", ""),
            "confirm_delete": False,
            "analysis_summary": proposal,
        }

        try:
            submission_response = await self.proposal_service.submit_proposal(
                proposal=submission_payload,
                agent_id=self.AGENT_ID,
                tool_id=tool_id,
            )
            logger.info(
                "Proposal submitted to Control Plane for %s.%s → tool=%s status=%s",
                object_name,
                field_name,
                tool_id,
                submission_response.get("status", "unknown"),
            )
            return submission_response

        except RuntimeError as exc:
            # Control Plane unavailable or rejected — return the local analysis result
            # so the caller still gets useful data while logging the submission failure.
            logger.warning(
                "Control Plane submission failed for %s.%s: %s. "
                "Returning local analysis result.",
                object_name,
                field_name,
                exc,
            )
            proposal["_submission_error"] = str(exc)
            return proposal