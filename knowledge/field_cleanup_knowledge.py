"""
Salesforce Field Cleanup & Lifecycle Domain Knowledge.
Codifies business rules and architectural invariants defined in CDM-OS specifications.
"""

from typing import Dict, Any, List


BUSINESS_RULES = {
    "BR-01": "A field with zero populated records is not automatically safe to delete.",
    "BR-02": "Deletion decisions must consider references in Apex, Flow, LWC/Aura, validation rules, formulas, reports, dashboards, and layouts.",
    "BR-03": "Standard Salesforce fields (e.g., CreatedDate, AccountNumber, Name) are permanent and must never be queued for deletion or deprecation.",
    "BR-04": "Managed package fields (namespace prefix with double underscore) must not be deleted autonomously.",
    "BR-05": "Every destructive or state-modifying action requires an immutable pre-modification backup and automated rollback capability.",
    "BR-06": "AI recommendations are advisory until explicit human authorization is recorded."
}

WORKFLOW_STAGES = [
    "CREATED",
    "FIELDSPY_STARTED",
    "FIELDSPY_ANALYSIS_RUNNING",
    "FIELDSPY_ANALYSIS_COMPLETE",
    "FIELDSPY_SHEET_EXTRACTED",
    "FIELDPRO_ANALYSIS_RUNNING",
    "FIELDPRO_ANALYSIS_COMPLETE",
    "IMPACT_ANALYSIS_RUNNING",
    "IMPACT_ANALYSIS_COMPLETE",
    "WAITING_FOR_APPROVAL",
    "APPROVED",
    "REMEDIATION",
    "DEPLOYMENT",
    "TESTING",
    "VERIFICATION",
    "COMPLETED"
]


def evaluate_field_cleanup_safety(
    is_custom: bool,
    usage_percentage: float,
    reference_count: int,
    field_name: str
) -> Dict[str, Any]:
    """
    Apply business rules to determine field cleanup safety status.
    """
    if not is_custom:
        return {
            "safe": False,
            "status": "STANDARD_FIELD_PROTECTED",
            "reason": f"Field '{field_name}' is a standard Salesforce field and cannot be deleted or modified."
        }

    if "__" in field_name and not field_name.endswith("__c"):
        return {
            "safe": False,
            "status": "MANAGED_PACKAGE_PROTECTED",
            "reason": f"Field '{field_name}' belongs to a managed package namespace and cannot be modified."
        }

    if reference_count > 0:
        return {
            "safe": False,
            "status": "ACTIVE_DEPENDENCIES_FOUND",
            "reason": f"Field '{field_name}' has {reference_count} active code/automation reference(s). Removal will cause runtime compilation failures."
        }

    if usage_percentage > 0.0:
        return {
            "safe": False,
            "status": "DATA_POPULATED",
            "reason": f"Field '{field_name}' has {usage_percentage}% populated records and is actively used by business records."
        }

    return {
        "safe": True,
        "status": "SAFE_FOR_DEPRECATION",
        "reason": f"Field '{field_name}' is 0% populated with zero detected references in Apex, Flows, or components."
    }
