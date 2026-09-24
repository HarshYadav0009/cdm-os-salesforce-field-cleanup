from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("RDC-OS MCP Gateway")


@mcp.tool()
def get_object_metadata(object_name: str) -> dict:
    """
    Return mock Salesforce object metadata.

    This is the first test tool.
    Salesforce integration will be added later.
    """

    if object_name.lower() == "account":
        return {
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
        "object": object_name,
        "fields": []
    }


@mcp.tool()
def health_check() -> dict:
    """Check whether the MCP server is running."""

    return {
        "status": "healthy",
        "service": "rdc-os-mcp-gateway"
    }


if __name__ == "__main__":
    mcp.run()