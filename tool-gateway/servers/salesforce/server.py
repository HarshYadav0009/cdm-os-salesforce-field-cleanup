from fastmcp import FastMCP

from servers.salesforce.metadata import SalesforceMetadataService
from servers.salesforce.field_usage import SalesforceFieldUsageService
from servers.salesforce.apex_references import ApexReferenceScanner
from servers.salesforce.field_assessment import FieldAssessmentService
from servers.salesforce.client import SalesforceClient


# ============================================================
# MCP SERVER
# ============================================================

mcp = FastMCP("Salesforce MCP Server")

# Shared client instance — single auth session per process lifecycle
_sf_client = None

def _get_client():
    global _sf_client
    if _sf_client is None:
        _sf_client = SalesforceClient()
    return _sf_client


# ============================================================
# HEALTH CHECK
# ============================================================

@mcp.tool()
def salesforce_health_check() -> dict:
    """
    Check whether the Salesforce MCP server can communicate with Salesforce.
    """
    service = SalesforceMetadataService(client=_get_client())
    result = service.describe_object("Account")
    return {
        "status": "healthy",
        "salesforce_connected": True,
        "object_tested": result["object"]
    }


# ============================================================
# OBJECT METADATA
# ============================================================

@mcp.tool()
def salesforce_describe_object(object_name: str) -> dict:
    """
    Return field-level metadata for a Salesforce SObject. Read-only.
    """
    service = SalesforceMetadataService(client=_get_client())
    return service.describe_object(object_name)


# ============================================================
# FIELD DATA USAGE
# ============================================================

@mcp.tool()
def salesforce_query_field_usage(object_name: str, field_name: str) -> dict:
    """
    Analyse Salesforce field data population (% of records with this field filled).
    
    Returns total_records, populated_records, usage_percentage,
    and zero_usage_candidate flag. Read-only.
    """
    service = SalesforceFieldUsageService(client=_get_client())
    return service.query_field_usage(object_name, field_name)


# ============================================================
# APEX / FLOW / METADATA REFERENCE SCAN
# ============================================================

@mcp.tool()
def salesforce_scan_apex_references(object_name: str, field_name: str) -> dict:
    """
    Scan all Salesforce metadata layers for references to a specific field.

    Checks:
    - Apex Classes (source body scan)
    - Apex Triggers (source body scan)
    - Flows & Process Builders (Tooling API)
    - Validation Rules (formula scan)
    - Page Layouts & Compact Layouts (Tooling API)
    - Field History Tracking status

    Returns is_safe_to_delete plus a per-layer breakdown of all references.
    Read-only. Tier-1.
    """
    scanner = ApexReferenceScanner(client=_get_client())
    return scanner.full_scan(object_name, field_name)


# ============================================================
# FULL FIELD ASSESSMENT (combined report)
# ============================================================

@mcp.tool()
def salesforce_full_field_assessment(object_name: str, field_name: str) -> dict:
    """
    Run a complete 3-phase field deletion safety assessment and return
    a structured report for human review.

    Phase 1 — Field Metadata: label, type, custom, nillable, etc.
    Phase 2 — Data Usage: % of records with this field populated.
    Phase 3 — Reference Scan: Apex, Triggers, Flows, Validation Rules,
               Layouts, and History Tracking.

    Returns a risk_level of:
    - SAFE_TO_DELETE   → 0% data + zero metadata references
    - NEEDS_REVIEW     → on layouts or history-tracked (but no code references)
    - BLOCKED          → still referenced in Apex, Flows, or Validation Rules

    This report becomes the proposal input_payload sent to the Control Plane
    for human approval. Read-only. Tier-1.
    """
    svc = FieldAssessmentService(client=_get_client())
    return svc.run(object_name, field_name)


# ============================================================
# SERVER ENTRY POINT
# ============================================================

if __name__ == "__main__":
    mcp.run()