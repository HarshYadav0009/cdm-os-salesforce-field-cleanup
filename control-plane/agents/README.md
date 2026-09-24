# Agent Registry — "Active Directory for AI Agents"

> **Architecture Reference: Section §3 — Agent Registry**

## Why This Folder Exists

Every AI agent in the organization must be a **known, registered entity**. You cannot have anonymous agents making production decisions. The Agent Registry is the single source of truth for: "Who is this agent? Who owns it? What can it do?"

## Purpose

This folder contains the **Agent Registry** service — the component that answers:

- **Who is this agent?** → Agent ID, name, domain
- **Who owns it?** → Primary & secondary guardian
- **What tier is it?** → Tier 1 / 2 / 3 (determines autonomy level)
- **What can it do?** → Allowed skills, tools, environments
- **Where can it operate?** → dev / qa / staging / production
- **When was it last reviewed?** → Compliance & governance tracking
- **What model does it use?** → Claude version, parameters
- **What version of its skill is deployed?** → Skill + prompt + knowledge versions

## Example Agent Record

```json
{
  "agentId": "sre-prod-007",
  "name": "Production SRE Remediation Agent",
  "domain": "SRE",
  "tier": 3,
  "primaryGuardian": "EMP-123",
  "secondaryGuardian": "EMP-456",
  "environment": ["production"],
  "status": "ACTIVE",
  "modelConfig": {
    "provider": "anthropic",
    "modelId": "claude-4",
    "parameters": { "temperature": 0.1 }
  },
  "skillVersion": "v1.2",
  "promptVersion": "v3.1",
  "knowledgeVersion": "v2.0",
  "lastReviewedAt": "2026-09-01",
  "lastReviewedBy": "EMP-789"
}
```

## What To Do Here

1. **`registry_service.py`** — Implement CRUD operations for agent records (register, update, deactivate, query)
2. **`agent_schema.py`** — Define the Agent data model (Pydantic/SQLAlchemy)
3. **`graduation.py`** — Implement tier graduation logic (Tier 1 → 2 → 3 requires AIGB approval)
4. **`kill_switch.py`** — Implement centralized stop mechanism:
   - Individual kill (stop Agent A)
   - Pod kill (stop all FinOps agents)
   - Capability kill (disable DELETE operations)
   - Global emergency stop (disable all autonomous production execution)
5. **`versioning.py`** — Track composite version = agent + skill + prompt + model + tool + policy + knowledge

## Key Design Decisions

- Agent identity ≠ Human identity (Section §5). The agent has its own identity; the human _owns_ it.
- Status lifecycle: `REGISTERED → ACTIVE → SUSPENDED → QUARANTINED → DECOMMISSIONED`
- Every status change must generate an audit event
