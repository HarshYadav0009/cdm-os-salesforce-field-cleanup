"""
Salesforce MCP Server Entry Point.
Sprint 1 Deliverable: tool-gateway/servers/salesforce_mcp.py
"""

from servers.salesforce.server import mcp

if __name__ == "__main__":
    mcp.run()
