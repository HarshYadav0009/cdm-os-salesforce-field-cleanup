# Audit & Traceability — Immutable Action Logs

> **Architecture Reference: Section §32 — Audit/Traceability Architecture, §45 — Incident Investigation**

## Why This Folder Exists

Every important agent action must generate an **immutable audit event**. When an agent causes an incident, you must be able to reconstruct the exact chain: who, what, why, which model, which policy, which precedent, what happened.

## Purpose

This folder implements the **Agent Traceability Log** — the immutable record of every decision and action taken within CDM-OS.

## Example Audit Event

```json
{
  "eventId": "evt-123",
  "agentId": "sre-prod-007",
  "guardianId": "emp-123",
  "action": "restart_service",
  "resource": "service-x",
  "reason": "high_latency",
  "precedentId": "PRE-2026-0012",
  "policyDecision": "ALLOW",
  "timestamp": "2026-09-24T10:00:00Z",
  "modelVersion": "claude-4",
  "promptVersion": "v3.1",
  "skillVersion": "v1.2",
  "knowledgeVersion": "v2.0",
  "context": { "latency_ms": 4500, "threshold_ms": 1000 },
  "result": "SUCCESS"
}
```

## Incident Investigation Flow (Section §45)

When something goes wrong, trace backwards:

```
Incident
  ↓ Agent ID
  ↓ Agent version
  ↓ Model version
  ↓ Prompt version
  ↓ Context (what the agent saw)
  ↓ Precedents (what historical decisions influenced it)
  ↓ Tools called
  ↓ Policies evaluated
  ↓ Actions taken
  ↓ Outcome
```

This is **AI observability + reproducibility**.

## What To Do Here

1. **`audit_service.py`** — Write immutable audit events to the audit log
2. **`audit_schema.py`** — Define audit event data model
3. **`audit_query.py`** — Query audit logs by agent, time range, action type, result
4. **`replay.py`** — Reconstruct the full decision chain for incident investigation

## Key Design Decisions

- Audit events are **append-only** — never updated or deleted
- Every component in the control plane emits audit events (policy decisions, approvals, workflow transitions, tool calls)
- Audit data supports the "Agent Multiplier" concept by enabling cost-per-task, cost-per-agent metrics
- Retention policy: audit logs are kept for compliance periods (define per organization)
