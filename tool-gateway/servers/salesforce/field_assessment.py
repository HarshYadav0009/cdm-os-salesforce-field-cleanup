"""
CDM-OS — Full Field Assessment & Deletion Safety Report Generator

Combines:
1. Field Metadata (describe_object)
2. Data Population Analysis (field_usage)
3. Apex/Flow/Layout Reference Scan (apex_references)

Produces a comprehensive, human-readable risk report and a structured
deletion_recommendation for the Control Plane Policy Engine.
"""

import logging
from datetime import datetime, timezone

from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .field_usage import SalesforceFieldUsageService
from .apex_references import ApexReferenceScanner
from .validators import validate_salesforce_identifier

logger = logging.getLogger("cdm.field_assessment")


# Risk levels
RISK_SAFE = "SAFE_TO_DELETE"
RISK_REVIEW = "NEEDS_REVIEW"
RISK_BLOCKED = "BLOCKED"


def _risk_level(usage: dict, refs: dict) -> str:
    """
    Determine risk level from usage and reference scan data.
    
    BLOCKED      → field is referenced by code, automation, Lightning components, or validation rules
    NEEDS_REVIEW → field has history tracking OR is on page layouts
    SAFE_TO_DELETE → zero data + zero references + no tracking
    """
    has_apex = len([r for r in refs.get("apex_classes", []) if "scan_error" not in r]) > 0
    has_triggers = len([r for r in refs.get("apex_triggers", []) if "scan_error" not in r]) > 0
    has_flows = len([r for r in refs.get("flows", []) if "scan_error" not in r]) > 0
    has_lwcs = len([r for r in refs.get("lwcs", []) if "scan_error" not in r]) > 0
    has_validation = len([r for r in refs.get("validation_rules", []) if "scan_error" not in r]) > 0

    if has_apex or has_triggers or has_flows or has_lwcs or has_validation:
        return RISK_BLOCKED

    has_layouts = len([r for r in refs.get("layouts", []) if "scan_error" not in r]) > 0
    has_history = refs.get("history_tracking_enabled", False)
    has_data = usage.get("usage_percentage", 0) > 0

    if has_layouts or has_history or has_data:
        return RISK_REVIEW

    return RISK_SAFE


def _build_report(
    object_name: str,
    field_name: str,
    field_meta: dict,
    usage: dict,
    refs: dict,
    risk: str,
) -> dict:
    """
    Build the full structured assessment report that will become
    the proposal input_payload for the Control Plane.
    """

    apex_blocked_names = [
        r["name"] for r in refs.get("apex_classes", []) if "scan_error" not in r
    ]
    trigger_blocked_names = [
        r["name"] for r in refs.get("apex_triggers", []) if "scan_error" not in r
    ]
    flow_blocked_names = [
        r["name"] for r in refs.get("flows", []) if "scan_error" not in r
    ]
    validation_blocked_names = [
        r["name"] for r in refs.get("validation_rules", []) if "scan_error" not in r
    ]
    lwc_blocked_names = [
        r["name"] for r in refs.get("lwcs", []) if "scan_error" not in r
    ]
    layout_names = [
        r["name"] for r in refs.get("layouts", []) if "scan_error" not in r
    ]

    if risk == RISK_BLOCKED:
        blocking_component_count = len(
            apex_blocked_names
            + trigger_blocked_names
            + flow_blocked_names
            + lwc_blocked_names
            + validation_blocked_names
        )
        summary = (
            f"🚫 BLOCKED — '{field_name}' is still referenced in code or business logic. "
            f"It CANNOT be safely deleted without modifying {blocking_component_count} component(s)."
        )
        recommendation = (
            "Remove all Apex, Flow, Lightning component, and Validation Rule references before attempting deletion. "
            "See the reference_scan section for exact file names and line numbers."
        )
    elif risk == RISK_REVIEW:
        summary = (
            f"⚠️ NEEDS REVIEW — '{field_name}' has 0% data population but appears on page layouts "
            f"or has history tracking enabled. Human review recommended before deletion."
        )
        recommendation = (
            "Remove the field from all page layouts and disable history tracking before deletion. "
            "A human approver must confirm this field is safe to remove."
        )
    else:
        summary = (
            f"✅ SAFE TO DELETE — '{field_name}' has 0% data usage and no references "
            f"in Apex, Flows, Validation Rules, or Layouts. Deletion is safe pending human approval."
        )
        recommendation = (
            "This field passes all automated safety checks. "
            "A human approver should do a final visual confirmation before deletion proceeds."
        )

    return {
        # ── Core identifiers ──────────────────────────────────
        "proposal_type": "FIELD_CLEANUP_ASSESSMENT",
        "object_api_name": object_name,
        "field_api_name": field_name,
        "assessed_at": datetime.now(timezone.utc).isoformat(),

        # ── Field metadata summary ────────────────────────────
        "field_metadata": {
            "label": field_meta.get("label"),
            "type": field_meta.get("type"),
            "is_custom": field_meta.get("custom"),
            "length": field_meta.get("length"),
            "nillable": field_meta.get("nillable"),
            "createable": field_meta.get("createable"),
            "updateable": field_meta.get("updateable"),
        },

        # ── Data usage analysis ───────────────────────────────
        "data_usage": {
            "total_records": usage.get("total_records", 0),
            "populated_records": usage.get("populated_records", 0),
            "usage_percentage": usage.get("usage_percentage", 0.0),
            "zero_usage_candidate": usage.get("zero_usage_candidate", False),
        },

        # ── Reference scan results ────────────────────────────
        "reference_scan": {
            "apex_classes": refs.get("apex_classes", []),
            "apex_triggers": refs.get("apex_triggers", []),
            "flows": refs.get("flows", []),
            "lwcs": refs.get("lwcs", []),
            "validation_rules": refs.get("validation_rules", []),
            "layouts": refs.get("layouts", []),
            "history_tracking_enabled": refs.get("history_tracking_enabled", False),
            "total_metadata_references": refs.get("total_metadata_references", 0),
        },

        # ── Impact summary (easy reading for human reviewer) ──
        "impact_summary": {
            "apex_classes_affected": apex_blocked_names,
            "apex_triggers_affected": trigger_blocked_names,
            "flows_affected": flow_blocked_names,
            "lightning_components_affected": lwc_blocked_names,
            "validation_rules_affected": validation_blocked_names,
            "layouts_affected": layout_names,
            "history_tracking": refs.get("history_tracking_enabled", False),
        },

        # ── Final risk assessment ─────────────────────────────
        "risk_level": risk,
        "deletion_recommendation": risk,
        "assessment_summary": summary,
        "human_action_required": recommendation,

        # Control Plane routing fields
        "action": "REVIEW_FOR_DELETION",
    }


class FieldAssessmentService:
    """
    Orchestrates the full field safety assessment pipeline.
    Call run(object_name, field_name) to get a complete report.
    """

    def __init__(self, client: SalesforceClient = None):
        self.client = client or SalesforceClient()
        self.metadata_svc = SalesforceMetadataService(client=self.client)
        self.usage_svc = SalesforceFieldUsageService(client=self.client)
        self.ref_scanner = ApexReferenceScanner(client=self.client)

    def run(self, object_name: str, field_name: str) -> dict:
        """
        Run the full 3-phase assessment and return a structured report.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        logger.info(f"[1/3] Fetching field metadata for {object_name}.{field_name}")
        object_meta = self.metadata_svc.describe_object(object_name)
        field_meta = next(
            (f for f in object_meta.get("fields", []) if f.get("name") == field_name),
            {}
        )

        logger.info(f"[2/3] Analysing data population for {object_name}.{field_name}")
        usage = self.usage_svc.query_field_usage(object_name, field_name)

        logger.info(f"[3/3] Scanning Apex/Flow/Layout references for {field_name}")
        refs = self.ref_scanner.full_scan(object_name, field_name)

        risk = _risk_level(usage, refs)

        report = _build_report(object_name, field_name, field_meta, usage, refs, risk)

        logger.info(
            f"Assessment complete for {object_name}.{field_name} → Risk: {risk} | "
            f"References: {refs['total_metadata_references']}"
        )
        return report
