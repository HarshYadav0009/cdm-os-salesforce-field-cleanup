from fastmcp import FastMCP

from servers.salesforce.metadata import SalesforceMetadataService
from servers.salesforce.field_usage import SalesforceFieldUsageService


# ============================================================
# MCP SERVER
# ============================================================

mcp = FastMCP(
    "Salesforce MCP Server"
)


# ============================================================
# HEALTH CHECK
# ============================================================

@mcp.tool()
def salesforce_health_check() -> dict:
    """
    Check whether the Salesforce MCP server
    can communicate with Salesforce.
    """

    service = SalesforceMetadataService()

    result = service.describe_object(
        "Account"
    )

    return {
        "status": "healthy",
        "salesforce_connected": True,
        "object_tested": result["object"]
    }


# ============================================================
# OBJECT METADATA
# ============================================================

@mcp.tool()
def salesforce_describe_object(
    object_name: str
) -> dict:
    """
    Return metadata for a Salesforce object.

    This operation is read-only.
    """

    service = SalesforceMetadataService()

    return service.describe_object(
        object_name
    )


# ============================================================
# FIELD USAGE ANALYSIS
# ============================================================

@mcp.tool()
def salesforce_query_field_usage(
    object_name: str,
    field_name: str
) -> dict:
    """
    Analyze Salesforce field population.

    This operation is read-only.

    The result identifies whether a field has
    zero populated records. It does NOT make
    a deletion decision.
    """

    service = SalesforceFieldUsageService()

    return service.query_field_usage(
        object_name,
        field_name
    )


# ============================================================
# SERVER ENTRY POINT
# ============================================================

if __name__ == "__main__":

    mcp.run()