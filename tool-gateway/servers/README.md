# MCP Servers — External System Connectors

> **Architecture Reference: Sections §22-23 — Tool Gateway, MCP**

## Why This Folder Exists

Each external system (AWS, Salesforce, GitHub, Datadog, etc.) gets its own MCP server. MCP servers translate agent tool calls into actual API calls against the external system.

## Purpose

Each server in this folder is a standalone MCP-compatible server that:
- Exposes a set of **tools** (e.g., `describe_fields`, `query_records`, `stop_ec2`)
- Handles **authentication** with the external system
- Enforces **rate limits** and **safety checks** specific to that system
- Returns structured results back to the agent through the MCP protocol

## What To Do Here

Create a subfolder for each external system integration:

1. **`salesforce/`** — Salesforce MCP Server
   - Tools: `describe_objects`, `describe_fields`, `query_soql`, `read_metadata`, `deploy_metadata`
   - Connects to: Salesforce REST API, Metadata API, Tooling API
   - **This is the primary server for the field-cleanup agent**

2. **`aws/`** — AWS MCP Server
   - Tools: `describe_ec2`, `stop_ec2`, `describe_rds`, `get_cost_data`
   - Connects to: AWS SDK (boto3)

3. **`github/`** — GitHub MCP Server
   - Tools: `create_pr`, `list_files`, `get_diff`, `merge_pr`
   - Connects to: GitHub REST/GraphQL API

4. **`datadog/`** — Datadog MCP Server
   - Tools: `get_metrics`, `get_alerts`, `query_logs`
   - Connects to: Datadog API

5. **`jira/`** — Jira MCP Server
   - Tools: `create_issue`, `update_issue`, `search_issues`
   - Connects to: Jira REST API

6. **`slack/`** — Slack MCP Server
   - Tools: `send_message`, `send_approval_request`
   - Connects to: Slack Web API

## Key Design Decisions

- Each server is **independently deployable** and **independently testable**
- Servers enforce their own rate limits (respecting external API quotas)
- Credentials are **injected by the MCP Gateway**, not stored inside the server
- Each server has its own `requirements.txt` and can run as its own service
