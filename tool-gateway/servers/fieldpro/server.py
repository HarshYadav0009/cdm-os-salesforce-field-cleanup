"""
FieldPro MCP Server.
Provides governed MCP tools for FieldPro dependency discovery:
- search_field
- get_field_details
- get_references
- get_dependency
"""

from typing import Dict, Any, List
from fastmcp import FastMCP

mcp = FastMCP("FieldPro MCP Server")


@mcp.tool()
def fieldpro_search_field(field_query: str) -> List[Dict[str, Any]]:
    """Search for fields matching query in FieldPro dependency index."""
    matches = [
        {
            "object": "Account",
            "field": "Legacy_Cleanup_Test__c",
            "type": "textarea",
            "custom": True,
            "references_count": 0
        },
        {
            "object": "Account",
            "field": "Legacy_Notes__c",
            "type": "textarea",
            "custom": True,
            "references_count": 1
        },
        {
            "object": "Account",
            "field": "Sync_Status__c",
            "type": "string",
            "custom": True,
            "references_count": 1
        }
    ]
    return [m for m in matches if field_query.lower() in m["field"].lower()]


@mcp.tool()
def fieldpro_get_field_details(object_name: str, field_name: str) -> Dict[str, Any]:
    """Retrieve detailed FieldPro metadata and history for a field."""
    return {
        "object": object_name,
        "field": field_name,
        "created_by": "005000000001AAA",
        "created_date": "2021-04-12T10:00:00Z",
        "last_modified_date": "2021-06-15T14:30:00Z",
        "description": f"FieldPro tracked field {field_name} on {object_name}",
        "data_category": "Unclassified"
    }


@mcp.tool()
def fieldpro_get_references(object_name: str, field_name: str) -> Dict[str, Any]:
    """Inspect references for a field across code, automation, layouts, and reports."""
    if field_name == "Legacy_Notes__c":
        refs = [
            {
                "type": "ApexClass",
                "name": "AccountService",
                "reference_type": "READ",
                "line": 6
            }
        ]
    elif field_name == "Sync_Status__c":
        refs = [
            {
                "type": "Flow",
                "name": "Account_Status_Automation",
                "reference_type": "READ_WRITE",
                "element": "Decision"
            }
        ]
    else:
        refs = []

    return {
        "object": object_name,
        "field": field_name,
        "total_references": len(refs),
        "references": refs,
        "safe_for_deletion": len(refs) == 0
    }


@mcp.tool()
def fieldpro_get_dependency(object_name: str, field_name: str) -> Dict[str, Any]:
    """Return dependency graph (upstream inputs and downstream consumers)."""
    refs_info = fieldpro_get_references(object_name, field_name)
    return {
        "object": object_name,
        "field": field_name,
        "upstream_dependencies": [],
        "downstream_consumers": refs_info["references"],
        "critical_path": len(refs_info["references"]) > 0
    }


if __name__ == "__main__":
    mcp.run()
