# Workflow & Orchestration Engine — Durable State Machines

> **Architecture Reference: Sections §29-31 — Workflow Engine, Retry Control**

## Why This Folder Exists

Complex agent tasks (investigate an outage, remediate, verify) have multiple steps. If the LLM "remembers" the workflow state, you lose it on crash, context overflow, or hallucination. The workflow state must live in a **durable, external engine** — not inside the LLM's context window.

## Purpose

This folder implements durable workflow orchestration:

- **State machines** for multi-step agent tasks
- **Retry control** (the 5-retry rule from the architecture doc)
- **Checkpoint/resume** — agents can pick up where they left off
- **Approval gates** — workflows pause for human approval when required

## Workflow State Machine

```
START
  │
  ▼
INVESTIGATE
  │
  ▼
PLAN
  │
  ▼
POLICY_CHECK
  │
 ┌┴───────────────┐
 │                │
ALLOW            DENY
 │                │
 ▼                ▼
EXECUTE         ESCALATE
 │
 ▼
VERIFY
 │
 ▼
AUDIT
 │
 ▼
COMPLETE
```

## Retry Control (Section §31)

The agent itself should **never** decide "I'll just try 100 more times."

```
Task
 ↓
Attempt 1 → Fail
 ↓
Attempt 2 → Fail
 ↓
...
 ↓
Attempt 5 → STOP → Escalate to Human
```

Retry limits are enforced by the workflow engine, not the LLM.

## What To Do Here

1. **`workflow_engine.py`** — Core state machine execution engine
2. **`workflow_schema.py`** — Define workflow states, transitions, and conditions
3. **`retry_manager.py`** — Implement retry logic with configurable limits per task type
4. **`state_store.py`** — Persist workflow state to PostgreSQL (durable, not in-memory)
5. **`orchestrator.py`** — Multi-agent orchestration (e.g., SRE Orchestrator spawning Datadog + Splunk + Error analyzers)

## Key Design Decisions

- **Never let the LLM own workflow state** (Section §30) — the LLM reasons within each step; the engine tracks progress
- Workflows are defined as data (YAML/JSON state machine definitions), not hardcoded
- Every state transition is logged as an audit event
- Failed workflows are preserved for post-mortem analysis
