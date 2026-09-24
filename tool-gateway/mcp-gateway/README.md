# MCP Gateway — Model Context Protocol Routing Layer

> **Architecture Reference: Section §23 — MCP Fits Here**

## Why This Folder Exists

MCP (Model Context Protocol) provides a standardized interface between agents and external tools. This gateway routes MCP tool calls from agents to the appropriate MCP server, while enforcing policy and injecting credentials.

## Purpose

```
Agent → MCP Client → MCP Gateway → Policy Check → MCP Server → External System
```

The gateway ensures that:
- The agent is **authorized** to call this tool
- The action passes **policy evaluation**
- **Ephemeral credentials** are injected (not stored by the agent)
- The call is **logged** to the audit trail

## What To Do Here

1. **`gateway.py`** — Core MCP gateway: route tool calls to the right MCP server
2. **`auth.py`** — Validate agent identity before forwarding requests
3. **`policy_check.py`** — Pre-flight policy evaluation on every tool call
4. **`credential_injector.py`** — Inject ephemeral credentials for the target system
5. **`logging.py`** — Log every tool call with agent ID, tool name, params, result

## Key Design Decisions

- MCP should **not** become a bypass around the central policy layer
- Even though MCP servers enforce their own constraints, the gateway adds the CDM-OS policy layer on top
- All MCP traffic is logged for audit and cost attribution
