# Control Plane — Tool Gateway (Internal Routing)

> **Architecture Reference: Section §22 — Tool Gateway**

## Why This Folder Exists

This is the Control Plane's internal tool gateway routing. When a policy decision results in ALLOW, the control plane needs to route the authorized action to the correct tool. This folder contains the routing logic that maps agent actions to the correct Tool Gateway server.

## Purpose

```
Policy Engine → ALLOW → CP Tool Router → Tool Gateway → MCP Server → External System
```

## What To Do Here

1. **`tool_router.py`** — Map authorized actions to the correct tool gateway endpoint
2. **`tool_registry.py`** — Registry of available tools and their capabilities
3. **`tool_health.py`** — Health checking for tool gateways (is the Salesforce MCP server up?)

## Key Design Decisions

- This is the control plane's **internal** view of tools, separate from the tool-gateway's implementation
- The router is used for audit attribution: "which tool handled this action?"
- Tool health checks enable graceful degradation (if a tool is down, escalate to human)
