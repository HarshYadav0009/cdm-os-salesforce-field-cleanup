from fastmcp import FastMCP

from servers.salesforce.metadata import SalesforceMetadataService
from servers.salesforce.field_usage import SalesforceFieldUsageService
from servers.salesforce.client import SalesforceClient


# ============================================================
# MCP SERVER
# ============================================================

mcp = FastMCP(
    "Salesforce MCP Server"
)

# Shared client instance — single auth session
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
    Check whether the Salesforce MCP server
    can communicate with Salesforce.
    """

    service = SalesforceMetadataService(client=_get_client())

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

    service = SalesforceMetadataService(client=_get_client())

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

    service = SalesforceFieldUsageService(client=_get_client())

    return service.query_field_usage(
        object_name,
        field_name
    )



# ============================================================
# SERVER ENTRY POINT
# ============================================================

if __name__ == "__main__":

    mcp.run()