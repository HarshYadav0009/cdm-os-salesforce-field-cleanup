# Human Approval System — Tier-Based Authorization Gates

> **Architecture Reference: Sections §10-12 — Tier Runtimes, §26 — Before Remediation**

## Why This Folder Exists

Not every agent action should execute automatically. The tier system defines when human approval is required. This folder implements the approval routing, notification, and tracking system.

## Purpose

Route agent proposals to the right human for approval based on the agent's tier and the action's risk level.

## Tier-Based Approval Matrix

### Tier 1 — Always Human Review
```
Agent generates → PR → Human reviews → Merge
```
No autonomous execution. Every output is a proposal.

### Tier 2 — Plan Approval
```
Intent → Plan → Policy validation → Human approves plan → Agent executes → Validation → Report
```
The human approves the **plan**, not each individual step.

### Tier 3 — Policy-Only (Autonomous within guardrails)
```
Trigger → Agent → Plan → Policy Engine → Risk Evaluation → Execute → Verify → Audit → Report
```
Human approval is NOT required for every operation — but the agent **must** stay inside its predefined policy. If the policy engine returns ESCALATE, it still goes to a human.

## What To Do Here

1. **`approval_service.py`** — Create, track, and resolve approval requests
2. **`approval_router.py`** — Route approvals to Guardian / Skill Lead / AIGB based on risk level
3. **`approval_schema.py`** — Define approval request data model (who, what, why, when, status)
4. **`notification.py`** — Send approval requests via Slack / email / Teams
5. **`timeout_handler.py`** — Handle approval timeouts (auto-deny or escalate after N minutes)

## Key Design Decisions

- Approval requests include the full context: agent ID, proposed action, affected resources, cost estimate, policy evaluation result
- Approvals have TTLs — an unanswered approval auto-escalates or auto-denies
- Every approval/rejection is an immutable audit event
- AIGB approval is required for: Tier 3 graduation, high-risk capabilities, global policy changes, model upgrades
