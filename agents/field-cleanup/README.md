# Salesforce Field Cleanup Agent

> **Domain: Salesforce / FinOps | Tier: TBD | Guardian: TBD**

## Why This Agent Exists

Salesforce orgs accumulate hundreds of unused custom fields over time. These dead fields increase complexity, slow performance, confuse users, and cost money. This agent identifies unused fields and proposes cleanup actions.

## Purpose

1. **Scan** Salesforce org metadata to identify custom fields
2. **Analyze** field usage (last modified, populated record count, formula references, layout usage)
3. **Classify** fields as: Active / Low-Usage / Unused / Deprecated
4. **Propose** cleanup actions (archive, delete, merge)
5. **Submit** proposals through the approval pipeline (Tier 1: PR, Tier 2: plan approval)
6. **Execute** approved cleanups via Salesforce Metadata API
7. **Verify** that cleanup didn't break any dependent flows, reports, or integrations

## What To Do Here

1. **`skill.py`** — The agent's core skill: field analysis logic, usage scoring, cleanup proposal generation
2. **`config.yaml`** — Agent configuration: allowed environments, blast radius, tool list
3. **`prompts/`** — Versioned system instructions and prompt templates
4. **`tests/`** — Behavioral evaluation tests (does it correctly identify unused fields? Does it refuse to delete critical fields?)

## Blast Radius Policy

```yaml
agent: salesforce-field-cleanup-001

allowed:
  environments:
    - sandbox
    - dev

allowed_actions:
    - read_metadata
    - describe_fields
    - query_usage
    - propose_cleanup

denied_actions:
    - delete_field_production
    - modify_permissions
    - alter_security_settings

max_fields_per_operation: 50
requires_approval: true
```

## Key Design Decisions

- This agent should **never** directly delete fields in production without human approval
- Cleanup proposals include: field name, object, last used date, populated record %, dependent items
- The agent uses the Salesforce MCP server (in `tool-gateway/`) for all API interactions
