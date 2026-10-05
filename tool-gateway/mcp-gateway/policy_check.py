import logging
from typing import Dict, Any

logger = logging.getLogger("mcp_gateway.policy")

TIER_1_TOOLS = {
    "salesforce_health_check",
    "salesforce_describe_global",
    "salesforce_describe_object",
    "salesforce_get_field_metadata",
    "salesforce_query_field_usage",
    "salesforce_scan_apex_references",
    "salesforce_search_flow",
    "salesforce_search_lwc",
    "salesforce_bulk_scan"
}

TIER_2_TOOLS = {
    "salesforce_backup_field_definition",
    "salesforce_deprecate_field",
    "salesforce_rollback_field"
}

TIER_3_TOOLS = {
    "salesforce_delete_field"
}


def evaluate_tool_policy(
    tool_name: str,
    payload: Dict[str, Any],
    environment: str = "sandbox"
) -> Dict[str, Any]:
    """
    Pre-flight Policy Decision Point (PDP) check.
    Returns:
    - decision: ALLOW | DENY | ESCALATE
    - tier: Tier-1 | Tier-2 | Tier-3
    - reason: String explanation
    """
    field_name = payload.get("field_name") or payload.get("field") or ""

    # Rule: Standard fields cannot be modified, deleted, or deprecated
    standard_fields = {"id", "name", "accountnumber", "createddate", "lastmodifieddate", "systemmodstamp"}
    if field_name.lower() in standard_fields:
        return {
            "decision": "DENY",
            "tier": "Tier-3",
            "reason": f"Standard Salesforce field '{field_name}' cannot be modified or deprecated."
        }

    # Rule: Tier 3 destructive operations require Human-in-the-Loop approval
    if tool_name in TIER_3_TOOLS:
        return {
            "decision": "ESCALATE",
            "tier": "Tier-3",
            "reason": f"Destructive tool '{tool_name}' requires human approval before execution."
        }

    # Rule: Tier 2 reversible modifications
    if tool_name in TIER_2_TOOLS:
        return {
            "decision": "ALLOW",
            "tier": "Tier-2",
            "reason": "Reversible configuration modification allowed under sandbox governance."
        }

    # Rule: Tier 1 read-only inspection
    if tool_name in TIER_1_TOOLS:
        return {
            "decision": "ALLOW",
            "tier": "Tier-1",
            "reason": "Read-only metadata and population query auto-approved."
        }

    return {
        "decision": "DENY",
        "tier": "Tier-3",
        "reason": f"Unrecognized or unregistered tool '{tool_name}'."
    }
