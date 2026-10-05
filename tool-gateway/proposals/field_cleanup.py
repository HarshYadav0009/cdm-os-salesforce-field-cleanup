from uuid import uuid4
from typing import Dict, Any, Optional


class FieldCleanupProposalBuilder:
    """
    Builds structured, auditable field cleanup proposals containing:
    - SObject and field metadata
    - SOQL population evidence
    - Code and automation reference evidence (Apex, Flows, Triggers)
    - Precedent analysis
    - Risk rating and recommended action
    """

    def build(
        self,
        usage_result: Dict[str, Any],
        metadata_result: Dict[str, Any],
        reference_result: Optional[Dict[str, Any]] = None,
        precedent_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:

        if not usage_result:
            raise ValueError("usage_result is required")

        if not metadata_result:
            raise ValueError("metadata_result is required")
            raise ValueError("metadata_result is required")

        object_name = usage_result.get("object")
        field_name = usage_result.get("field")

        if not object_name:
            raise ValueError("Usage result does not contain object")

        if not field_name:
            raise ValueError("Usage result does not contain field")
            raise ValueError("Usage result does not contain field")

        field_metadata = None
        for field in metadata_result.get("fields", []):
        for field in metadata_result.get("fields", []):
            if field.get("name") == field_name:
                field_metadata = field
                break

        if field_metadata is None:
            raise ValueError(f"Field {field_name} was not found in metadata")

        # Dependency evidence
        has_refs = False
        ref_count = 0
        ref_summary = "Not scanned"
        if reference_result:
            has_refs = reference_result.get("has_references", False)
            ref_count = reference_result.get("reference_count", 0)
            ref_summary = reference_result.get("summary", "")

        # Usage evidence
        usage_pct = usage_result.get("usage_percentage", 0.0)
        zero_usage = usage_result.get("zero_usage_candidate", False)

        # Risk assessment
        is_custom = field_metadata.get("custom", False)
        if not is_custom:
            risk_level = "CRITICAL"
            safe_to_cleanup = False
            recommended_action = "RETAIN_STANDARD_FIELD"
        elif has_refs:
            risk_level = "HIGH"
            safe_to_cleanup = False
            recommended_action = "RETAIN_ACTIVE_REFERENCES"
        elif usage_pct > 0.0:
            risk_level = "MEDIUM"
            safe_to_cleanup = False
            recommended_action = "RETAIN_DATA_POPULATED"
        else:
            risk_level = "LOW"
            safe_to_cleanup = True
            recommended_action = "DEPRECATE_FIELD"

        # Check precedent warnings
        precedent_warning = None
        if precedent_result and precedent_result.get("has_precedent"):
            if precedent_result.get("status") == "REJECTION_PRECEDENT_ACTIVE":
                risk_level = "HIGH"
                safe_to_cleanup = False
                precedent_warning = precedent_result.get("warning")
                recommended_action = "RETAIN_PRECEDENT_REJECTION"

        return {
            "proposal_id": str(uuid4()),
            "proposal_type": "FIELD_CLEANUP",
            "resource": {
                "object": object_name,
                "field": field_name
            },
            "field": {
                "name": field_name,
                "label": field_metadata.get("label"),
                "type": field_metadata.get("type"),
                "custom": is_custom,
                "description": field_metadata.get("description", "")
            },
            "evidence": {
                "total_records": usage_result.get("total_records", 0),
                "populated_records": usage_result.get("populated_records", 0),
                "usage_percentage": usage_pct,
                "zero_usage_candidate": zero_usage,
                "has_code_references": has_refs,
                "reference_count": ref_count,
                "reference_summary": ref_summary,
                "precedent_warning": precedent_warning
            },
            "risk_assessment": {
                "risk_level": risk_level,
                "safe_to_cleanup": safe_to_cleanup,
                "recommended_action": recommended_action
            },
            "action": {
                "type": recommended_action,
                "tier": "Tier-2" if safe_to_cleanup else "Tier-1",
                "destructive": False
            },
            "approval": {
                "required": True,
                "status": "PENDING"
            },
            "status": "PROPOSED"
        }