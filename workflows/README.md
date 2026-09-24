# Workflow Definitions — State Machine Templates

> **Architecture Reference: Sections §29-31 — Workflow Engine, Retry Control**

## Why This Folder Exists

Complex agent tasks (investigate → analyze → remediate → verify → audit) should be expressed as **state machine definitions**, not as one huge LLM prompt. This folder stores the workflow templates that the Workflow Engine (in `control-plane/workflow/`) executes.

## Purpose

Store declarative workflow definitions (YAML/JSON) that describe:
- **States** — the steps in a workflow
- **Transitions** — how to move between states
- **Conditions** — what triggers each transition
- **Retry limits** — max attempts per step before escalation
- **Approval gates** — which steps require human approval

## What To Do Here

1. **`incident-investigation.yaml`** — Multi-agent incident investigation workflow
2. **`resource-cleanup.yaml`** — Resource cleanup workflow (scan → propose → approve → execute → verify)
3. **`field-cleanup.yaml`** — Salesforce field cleanup workflow (specific to this project)
4. **`agent-deployment.yaml`** — Agent CI/CD deployment workflow (test → evaluate → shadow → deploy)
5. **`model-upgrade.yaml`** — Model upgrade workflow (regression → quality gate → deploy/block)
6. **`tier-graduation.yaml`** — Agent tier graduation workflow (evaluation → AIGB review → approve/deny)

## Example Workflow Definition

```yaml
# field-cleanup.yaml
name: salesforce-field-cleanup
version: "1.0"
max_retries: 5
timeout_minutes: 60

states:
  - id: SCAN
    description: "Scan Salesforce org for custom fields"
    tools: [salesforce_describe, salesforce_query]
    next: ANALYZE

  - id: ANALYZE
    description: "Score field usage and classify"
    next: PROPOSE

  - id: PROPOSE
    description: "Generate cleanup proposal"
    next: APPROVE

  - id: APPROVE
    description: "Wait for human approval"
    type: approval_gate
    approver: guardian
    timeout_minutes: 1440  # 24 hours
    on_timeout: ESCALATE
    on_approve: EXECUTE
    on_reject: COMPLETE

  - id: EXECUTE
    description: "Execute approved cleanup"
    tools: [salesforce_metadata_api]
    next: VERIFY

  - id: VERIFY
    description: "Verify cleanup didn't break anything"
    next: AUDIT

  - id: AUDIT
    description: "Record all actions to audit log"
    next: COMPLETE

  - id: ESCALATE
    description: "Escalate to Skill Lead"
    type: approval_gate
    approver: skill_lead

  - id: COMPLETE
    description: "Workflow finished"
    type: terminal
```

## Key Design Decisions

- Workflows are **data**, not code — making them easy to version, review, and modify
- The Workflow Engine in `control-plane/workflow/` loads these templates
- Every state transition generates an audit event
- Retry limits are enforced by the engine, not the LLM (the agent can't decide to try 100 more times)
