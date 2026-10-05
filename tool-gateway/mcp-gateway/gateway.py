import os
import sys
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Ensure parent and servers directories are in path
gateway_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
servers_dir = os.path.join(gateway_dir, "servers")
for p in (gateway_dir, servers_dir):
    if p not in sys.path:
        sys.path.insert(0, p)

from auth import authenticate_agent
from policy_check import evaluate_tool_policy
from servers.salesforce.validators import validate_tool_payload
from servers.salesforce.gateway_service import SalesforceToolGatewayService

logger = logging.getLogger("mcp_gateway.core")


class GovernedMCPGateway:
    """
    Central Policy-Enforced MCP Tool Gateway.
    Execution pipeline:
    Agent -> MCP Gateway -> Identity / Policy Check -> Audit Start -> Tool Execution -> Audit Result -> Caller
    """

    def __init__(self, salesforce_gateway: Optional[SalesforceToolGatewayService] = None):
        self.sf_service = salesforce_gateway or SalesforceToolGatewayService()

    def route_tool_call(
        self,
        agent_id: str,
        tool_name: str,
        payload: Dict[str, Any],
        environment: str = "sandbox"
    ) -> Dict[str, Any]:
        start_time = datetime.now(timezone.utc).isoformat()

        # 1. Identity & Auth Check
        auth_context = authenticate_agent(agent_id, tool_name)

        # 2. Pre-flight Policy Evaluation
        policy_result = evaluate_tool_policy(tool_name, payload, environment)
        if policy_result["decision"] == "DENY":
            raise PermissionError(
                f"Policy DENY for '{tool_name}': {policy_result['reason']}"
            )
        if policy_result["decision"] == "ESCALATE":
            return {
                "status": "PENDING_APPROVAL",
                "tool_name": tool_name,
                "tier": policy_result["tier"],
                "reason": policy_result["reason"],
                "message": "Tool execution halted. Human approval required."
            }

        # 3. Payload Schema Validation
        validated_payload = validate_tool_payload(tool_name, payload)

        # 4. Audit Log Start Event
        audit_event = {
            "event": "TOOL_INVOCATION_START",
            "agent_id": agent_id,
            "tool_name": tool_name,
            "tier": policy_result["tier"],
            "timestamp": start_time,
            "payload": validated_payload
        }
        logger.info(f"Audit log: {audit_event}")

        # 5. Isolated Tool Execution
        try:
            result = self.sf_service.execute(tool_name, validated_payload)
            success = True
            error_message = None
        except Exception as exc:
            success = False
            error_message = str(exc)
            logger.error(f"Tool execution failed for '{tool_name}': {exc}")
            raise

        finally:
            # 6. Audit Log Result Event
            finish_time = datetime.now(timezone.utc).isoformat()
            audit_result_event = {
                "event": "TOOL_INVOCATION_COMPLETE",
                "agent_id": agent_id,
                "tool_name": tool_name,
                "success": success,
                "error": error_message,
                "start_time": start_time,
                "end_time": finish_time
            }
            logger.info(f"Audit result log: {audit_result_event}")

        return {
            "status": "SUCCESS",
            "tool_name": tool_name,
            "agent_id": agent_id,
            "tier": policy_result["tier"],
            "data": result,
            "executed_at": finish_time
        }
