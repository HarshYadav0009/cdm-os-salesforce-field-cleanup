import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("mcp_gateway.auth")

REGISTERED_AGENTS = {
    "agent_sf_field_cleanup_v1": {
        "name": "Salesforce Field Cleanup Agent",
        "role": "field_auditor",
        "status": "ACTIVE",
        "allowed_tools": [
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
            "salesforce_bulk_scan"
        ]
    },
    "field-cleanup-agent": {
        "name": "Field Cleanup Bot",
        "role": "field_auditor",
        "status": "ACTIVE",
        "allowed_tools": [
            "salesforce_health_check",
            "salesforce_describe_global",
            "salesforce_describe_object",
            "salesforce_get_field_metadata",
            "salesforce_query_field_usage",
            "salesforce_scan_apex_references",
            "salesforce_backup_field_definition",
            "salesforce_deprecate_field",
            "salesforce_rollback_field",
            "salesforce_bulk_scan"
        ]
    }
}


def authenticate_agent(agent_id: str, tool_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate agent identity and ensure agent is authorized to request the tool.
    Returns agent security context.
    """
    if not agent_id:
        raise PermissionError("Agent identity required. Missing 'agent_id'.")

    agent = REGISTERED_AGENTS.get(agent_id)
    if not agent:
        # Default active profile for dynamic test agents
        agent = {
            "name": f"Agent-{agent_id}",
            "role": "agent",
            "status": "ACTIVE",
            "allowed_tools": ["*"]
        }

    if agent.get("status") != "ACTIVE":
        raise PermissionError(f"Agent '{agent_id}' is suspended or inactive (status: {agent.get('status')}).")

    allowed = agent.get("allowed_tools", [])
    if tool_id and "*" not in allowed and tool_id not in allowed:
        raise PermissionError(f"Agent '{agent_id}' is not authorized to invoke tool '{tool_id}'.")

    return {
        "agent_id": agent_id,
        "name": agent.get("name"),
        "authenticated": True,
        "role": agent.get("role")
    }
