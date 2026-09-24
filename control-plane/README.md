# Control Plane — The Brain of CDM-OS

> **This is Layer 2 of the architecture. Everything an agent wants to do flows through here.**

## Why This Folder Exists

The Control Plane is the central nervous system of CDM-OS. It sits between human governance (Layer 1) and the agent runtime (Layer 3). No agent action reaches the real world without the Control Plane authorizing it.

## What It Does

```
LLM says: "I want to delete EC2-123."

Control Plane evaluates:
├── Is agent allowed?           → identity/
├── Is resource allowed?        → policy/
├── Is environment allowed?     → policy/
├── Is action allowed?          → policy/
├── Is cost within limit?       → policy/
├── Is blast radius within limit? → policy/
├── Does this require human approval? → approvals/
│
└── Result: ALLOW / DENY / ESCALATE
```

## Subfolder Map

| Folder | Architecture Section | Purpose |
|---|---|---|
| `agents/` | §3 Agent Registry | "Active Directory for AI agents" — register, query, manage all agent identities |
| `identity/` | §4-5 Agent Identity & IAM | Unique agent identities, ephemeral IAM roles, credential lifecycle |
| `policy/` | §6-8 Policy & Guardrail Engine | Policy Decision Point (PDP) — evaluate every action against rules |
| `workflow/` | §29-31 Workflow Engine | Durable state machines for multi-step tasks, retry control |
| `approvals/` | §26 Human Approval | Tier-based approval routing — Tier 1 (always), Tier 2 (plan), Tier 3 (policy-only) |
| `audit/` | §32 Audit & Traceability | Immutable event log for every agent action |
| `api/` | API Surface | REST/gRPC endpoints exposing control plane to agent runtime and frontend |
| `database/` | Data Layer | PostgreSQL schemas, migrations, seed data |
| `tool-gateway/` | §22-23 Tool Access | Policy-enforced tool access (duplicated from top-level for CP-internal routing) |

## What To Do Here

1. **Start with `agents/`** — Define the Agent Registry schema and CRUD operations
2. **Then `identity/`** — Implement agent identity issuance and IAM role assumption
3. **Then `policy/`** — Build the Policy Decision Point engine
4. **Then `workflow/`** — Implement the state machine for agent task lifecycle
5. **Then `approvals/`** — Wire up human approval flows by tier
6. **Then `audit/`** — Log every decision immutably
7. **`api/`** — Expose all of the above as endpoints
8. **`database/`** — Schemas underpin everything; build early
