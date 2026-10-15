# Tool Gateway — Policy-Enforced External System Access

> **Architecture Reference: Sections §22-23 — Tool Gateway, MCP**

## Why This Folder Exists

Agents need to interact with the real world (AWS, Salesforce, GitHub, Jira, Datadog, etc.). But you should **never** give the LLM direct unrestricted access to these systems. Every tool call must go through a policy-enforced gateway.

## Purpose

The Tool Gateway mediates all agent interactions with external systems:

```
Agent
 ↓
Tool Gateway
 ↓
Policy check (is this agent allowed to call this tool with these params?)
 ↓
Credential injection (ephemeral IAM role)
 ↓
External System (AWS, Salesforce, etc.)
```

## Subfolder Map

| Folder | Purpose |
|---|---|
| `mcp-gateway/` | MCP (Model Context Protocol) client and server framework |
| `servers/` | Individual MCP tool servers for specific external systems |
| `requirements.txt` | Python dependencies for the tool gateway |

## MCP Architecture (Section §23)

MCP servers are the standardized interface between agents and external tools:

```
Agent → MCP Client → Salesforce MCP Server → Salesforce API
Agent → MCP Client → AWS MCP Server → AWS APIs
Agent → MCP Client → Datadog MCP Server → Datadog API
```

**Important**: The MCP server should still enforce authorization. MCP should **not** become a bypass around the central policy layer.

## What To Do Here

### In `mcp-gateway/`:
1. **`gateway.py`** — MCP gateway that routes tool calls to the appropriate MCP server
2. **`auth.py`** — Validate agent identity and inject ephemeral credentials
3. **`policy_check.py`** — Pre-flight policy check before forwarding to tool server

### In `servers/`:
1. **`salesforce/`** — Salesforce MCP server (Metadata API, SOQL, Tooling API)
2. **`aws/`** — AWS MCP server (EC2, RDS, IAM, S3, etc.)
3. **`github/`** — GitHub MCP server (PRs, code review, CI/CD)
4. **`datadog/`** — Datadog MCP server (metrics, alerts, dashboards)
5. **`jira/`** — Jira MCP server (issue tracking, sprint management)
6. **`slack/`** — Slack MCP server (notifications, approval requests)

Each server is a standalone service that can be developed and deployed independently.

## Salesforce Custom-Field Deprecation

The Tier-2 `salesforce_deprecate_field` operation backs up a custom field's
metadata and tags its description as deprecated. It leaves field-level security
and existing records unchanged. A failed update attempts to restore the
original description from the backup.

## Salesforce Custom-Field Deletion

`salesforce_delete_field` is a Tier-3 operation. It can be proposed only with
`confirm_delete: true`, and the Control Plane requires human approval before
dispatching it to `POST /tools/salesforce/delete`. The gateway accepts only
unmanaged custom fields and writes a metadata backup before calling Salesforce
Metadata API `CustomField.delete`.

The metadata backup is an audit snapshot, not a restore mechanism; deletion can
remove the field's data and cannot be reversed by this tool. Do not call the
gateway endpoint directly to bypass the Control Plane approval workflow.

## Key Design Decisions

- Tool calls are **never** made directly by the agent — always through the gateway
- Every tool call is logged to the audit trail
- Credentials are **injected by the gateway**, not stored by the agent
- Tool servers enforce their own rate limits and safety checks on top of the gateway's policy layer
