"""
CDM-OS — MCP Tool Gateway

Provides MCP tools that can be consumed by the CDM-OS Control Plane.

Governance is handled by the CDM-OS Control Plane through:
    - Tool registration
    - Policy evaluation
    - Proposal creation
    - Human approval
    - Audit logging

This gateway is responsible for exposing executable tools.
"""

from mcp.server.fastmcp import FastMCP


# ============================================================================
# MCP SERVER
# ============================================================================

mcp = FastMCP("CDM-OS MCP Gateway")


# ============================================================================
# TOOL 1 — SALESFORCE OBJECT METADATA
# ============================================================================

@mcp.tool()
def get_object_metadata(object_name: str) -> dict:
    """
    Return Salesforce object metadata.

    This is currently a mock implementation for testing the MCP
    connection. Salesforce integration can be connected later.

    Args:
        object_name: Salesforce object API name.

    Returns:
        Dictionary containing object metadata.
    """

    if not object_name:
        return {
            "success": False,
            "error": "object_name is required"
        }

    if object_name.lower() == "account":
        return {
            "success": True,
            "object": "Account",
            "fields": [
                {
                    "name": "Id",
                    "type": "ID",
                    "custom": False
                },
                {
                    "name": "Name",
                    "type": "STRING",
                    "custom": False
                },
                {
                    "name": "Industry",
                    "type": "PICKLIST",
                    "custom": False
                },
                {
                    "name": "Legacy_Code__c",
                    "type": "STRING",
                    "custom": True
                }
            ]
        }

    return {
        "success": True,
        "object": object_name,
        "fields": []
    }


# ============================================================================
# TOOL 2 — HEALTH CHECK
# ============================================================================

@mcp.tool()
def health_check() -> dict:
    """
    Check whether the CDM-OS MCP Tool Gateway is running.
    """

    return {
        "success": True,
        "status": "healthy",
        "service": "cdm-os-mcp-gateway",
        "governance": "control-plane"
    }


# ============================================================================
# SERVER STARTUP
# ============================================================================

if __name__ == "__main__":
    mcp.run()