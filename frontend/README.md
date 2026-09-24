# Frontend — Guardian & Governance Dashboard

> **Architecture Reference: Layer 1 — Human & Governance Layer**

## Why This Folder Exists

Humans (Guardians, Skill Leads, AIGB members) need a visual interface to:
- **Monitor** agent status and activity
- **Approve/Reject** agent proposals
- **View** audit trails
- **Trigger** kill switches
- **Review** cost metrics and drift detection
- **Manage** agent configurations and policies

## Purpose

The frontend dashboard provides the human interface to the CDM-OS Control Plane.

## What To Do Here

1. **Dashboard Pages:**
   - **Agent Overview** — List all agents, their status, tier, guardian, last activity
   - **Agent Detail** — Deep dive into a specific agent: config, recent actions, metrics
   - **Approval Queue** — Pending approval requests with context and one-click approve/reject
   - **Audit Trail** — Searchable log of all agent actions
   - **Policy Manager** — View and edit policy definitions (with PR-based approval)
   - **Digital Boardroom** — View agent conflicts and arbitration decisions
   - **Cost Dashboard** — Cost per agent/task/skill/guardian with trend charts
   - **Kill Switch Panel** — Emergency stop controls (individual, pod, capability, global)
   - **Drift Monitor** — Track behavioral drift across model/prompt/knowledge versions

2. **Key Components:**
   - `AgentCard` — Compact agent status display
   - `ApprovalModal` — Approve/reject with reason
   - `AuditTimeline` — Visual timeline of agent actions
   - `PolicyEditor` — YAML editor with validation
   - `CostChart` — FinOps cost visualization
   - `KillSwitchButton` — Emergency stop with confirmation

## Key Design Decisions

- The frontend connects to `control-plane/api/` for all data
- Real-time updates via WebSocket for approval requests and agent status changes
- Kill switch actions require confirmation and are heavily audited
- The dashboard should be usable by non-technical stakeholders (AIGB members)
