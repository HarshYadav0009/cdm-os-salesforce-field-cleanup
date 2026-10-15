from typing import Dict, Any, List, Optional
from fastmcp import FastMCP

from .metadata import SalesforceMetadataService
from .field_usage import SalesforceFieldUsageService
from .apex_scanner import SalesforceApexScanner
from .backup_service import SalesforceBackupService
from .deprecation_service import SalesforceFieldDeprecationService
from .deletion_service import SalesforceFieldDeletionService
from .bulk_scanner import SalesforceBulkScanner
from .validators import validate_tool_payload


# ============================================================
# MCP SERVER INITIALIZATION
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
def salesforce_health_check() -> Dict[str, Any]:
    """Check whether the Salesforce MCP server can communicate with Salesforce."""
    service = SalesforceMetadataService()
    result = service.describe_object("Account")
    return {
        "status": "healthy",
        "salesforce_connected": True,
        "object_tested": result["object"],
        "is_mock": service.client.is_mock
    }


# ============================================================
# METADATA TOOLS (READ-ONLY)
# ============================================================

@mcp.tool()
def salesforce_describe_global() -> Dict[str, Any]:
    """List all SObjects in the Salesforce org (standard and custom)."""
    service = SalesforceMetadataService()
    return service.describe_global()


@mcp.tool()
def salesforce_describe_object(object_name: str) -> Dict[str, Any]:
    """
    Return comprehensive field metadata for a Salesforce object.
    Read-only operation.
    """
    validated = validate_tool_payload("salesforce_describe_object", {"object_name": object_name})
    service = SalesforceMetadataService()
    return service.describe_object(validated["object_name"])


@mcp.tool()
def salesforce_get_field_metadata(object_name: str, field_name: str) -> Dict[str, Any]:
    """Retrieve detailed metadata for a single field on a Salesforce object."""
    validated = validate_tool_payload("salesforce_get_field_metadata", {"object_name": object_name, "field_name": field_name})
    service = SalesforceMetadataService()
    return service.get_field_metadata(validated["object_name"], validated["field_name"])


# ============================================================
# FIELD USAGE ANALYSIS (READ-ONLY)
# ============================================================

@mcp.tool()
def salesforce_query_field_usage(object_name: str, field_name: str) -> Dict[str, Any]:
    """
    Analyze Salesforce field population percentage.
    Read-only operation. Does NOT make an automated deletion decision.
    """
    validated = validate_tool_payload("salesforce_query_field_usage", {"object_name": object_name, "field_name": field_name})
    service = SalesforceFieldUsageService()
    return service.query_field_usage(validated["object_name"], validated["field_name"])


# ============================================================
# ADVANCED SCANNERS (APEX, FLOW, LWC)
# ============================================================

@mcp.tool()
def salesforce_scan_apex_references(object_name: str, field_name: str) -> Dict[str, Any]:
    """
    Scan Apex classes, triggers, flows, and LWCs for references to a field API name.
    """
    validated = validate_tool_payload("salesforce_scan_apex_references", {"object_name": object_name, "field_name": field_name})
    scanner = SalesforceApexScanner()
    return scanner.scan_all_references(validated["object_name"], validated["field_name"])


@mcp.tool()
def salesforce_search_flow(field_name: str) -> List[Dict[str, Any]]:
    """Search Salesforce Flows for references to a field API name."""
    scanner = SalesforceApexScanner()
    return scanner.scan_flows(field_name)


@mcp.tool()
def salesforce_search_lwc(field_name: str) -> List[Dict[str, Any]]:
    """Search Lightning Web Components for references to a field API name."""
    scanner = SalesforceApexScanner()
    return scanner.scan_lwc(field_name)


# ============================================================
# BACKUP & RESTORE TOOLS
# ============================================================

@mcp.tool()
def salesforce_backup_field_definition(object_name: str, field_name: str) -> Dict[str, Any]:
    """
    Export and persist an immutable metadata snapshot of a field definition
    before any modification.
    """
    validated = validate_tool_payload("salesforce_backup_field_definition", {"object_name": object_name, "field_name": field_name})
    backup_service = SalesforceBackupService()
    return backup_service.backup_field_definition(validated["object_name"], validated["field_name"])


@mcp.tool()
def salesforce_rollback_field(backup_id: str) -> Dict[str, Any]:
    """
    Roll back a modified field to its original state using a saved backup ID.
    """
    validated = validate_tool_payload("salesforce_rollback_field", {"backup_id": backup_id})
    backup_service = SalesforceBackupService()
    return backup_service.rollback_field(validated["backup_id"])


# ============================================================
# CONTROLLED FIELD DEPRECATION (TIER-2)
# ============================================================

@mcp.tool()
def salesforce_deprecate_field(
    object_name: str,
    field_name: str,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deprecate a Salesforce custom field:
    1. Creates automatic backup snapshot.
    2. Tags field description with [DEPRECATED].
    3. Leaves Field-Level Security unchanged.
    4. Automatically rolls back the description if an error occurs.
    """
    validated = validate_tool_payload("salesforce_deprecate_field", {
        "object_name": object_name,
        "field_name": field_name,
        "reason": reason
    })
    deprecate_service = SalesforceFieldDeprecationService()
    return deprecate_service.deprecate_field(
        validated["object_name"],
        validated["field_name"],
        validated.get("reason")
    )


# ============================================================
# APPROVED FIELD DELETION (TIER-3)
# ============================================================

@mcp.tool()
def salesforce_delete_field(
    object_name: str,
    field_name: str,
    confirm_delete: bool,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Back up and delete a custom field after policy and human approval."""
    validated = validate_tool_payload("salesforce_delete_field", {
        "object_name": object_name,
        "field_name": field_name,
        "confirm_delete": confirm_delete,
        "reason": reason,
    })
    deletion_service = SalesforceFieldDeletionService()
    return deletion_service.delete_field(
        validated["object_name"],
        validated["field_name"],
        validated["confirm_delete"],
        validated.get("reason"),
    )


# ============================================================
# BULK SCANNER
# ============================================================

@mcp.tool()
def salesforce_bulk_scan(
    object_names: Optional[List[str]] = None,
    threshold_percentage: float = 0.0
) -> Dict[str, Any]:
    """
    Execute bulk usage and reference scanning across multiple SObjects
    (Account, Contact, Opportunity, custom objects).
    """
    validated = validate_tool_payload("salesforce_bulk_scan", {
        "object_names": object_names,
        "threshold_percentage": threshold_percentage
    })
    bulk_service = SalesforceBulkScanner()
    return bulk_service.scan_objects(
        validated.get("object_names"),
        validated.get("threshold_percentage", 0.0)
    )


# ============================================================
# SERVER ENTRY POINT
# ============================================================

if __name__ == "__main__":
    mcp.run()
