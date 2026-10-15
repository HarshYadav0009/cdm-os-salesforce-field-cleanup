"""
Read-only API for policies loaded by the control-plane policy engine.
"""

from fastapi import APIRouter

from control_plane.config import settings
from control_plane.policy_engine import policy_engine

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.get("", include_in_schema=False)
@router.get("/")
def list_policies():
    """Return the policy mode and rules currently loaded in memory."""
    rules = [
        {
            "id": rule.rule_id,
            "action": rule.action,
            "source_file": rule.source_file,
            "tier": rule.tier,
            "conditions": rule.conditions,
            "enforcement": rule.enforcement,
        }
        for rule in policy_engine.rules
    ]
    return {
        "mode": settings.POLICY_MODE,
        "rule_count": len(rules),
        "rules": rules,
    }
