# Policy & Guardrail Engine — The Most Important Component

> **Architecture Reference: Sections §6-8 — Policy Engine, Policy Decision Point, Blast Radius**

## Why This Folder Exists

The LLM should **never** decide whether it has permission to perform an action. That decision belongs to a deterministic, machine-enforced policy engine. This is the **most important component** in the entire CDM-OS architecture.

## Purpose

This folder implements the **Policy Decision Point (PDP)** — the engine that evaluates every proposed agent action and returns one of three verdicts:

```
ALLOW    → Agent may proceed
DENY     → Action is blocked; reason logged
ESCALATE → Human approval required
```

## How It Works

```
Agent proposes: "DELETE EC2-123"
         │
         ▼
   Policy Engine
         │
         ├── Agent Tier = 3           ✓
         ├── Environment = DEV        ✓
         ├── Action = DELETE          ✓ (allowed for this agent)
         ├── Resource = EC2           ✓ (in scope)
         ├── Cost impact = $40        ✓ (under $500 limit)
         └── Within blast radius      ✓ (< 10 resources)
                  │
                  ▼
               ALLOW
```

But:
```
Agent proposes: "DELETE production database"
         │
         ▼
   Policy Engine
         │
         └── Action not permitted for this tier/environment
                  │
                  ▼
               DENY
```

## Blast Radius Configuration (Section §8)

Every agent has a machine-readable policy file:

```yaml
agent: finops-dev-007

allowed:
  environments:
    - dev
    - qa

allowed_actions:
    - read_ec2
    - stop_ec2
    - resize_ec2

denied_actions:
    - delete_rds
    - modify_iam
    - modify_network

max_cost_per_operation: 500
max_resources_per_operation: 10
```

## What To Do Here

1. **`policy_engine.py`** — Core PDP implementation: evaluate agent + action + resource + environment against rules
2. **`policy_schema.py`** — Define policy rule data models
3. **`blast_radius.py`** — Implement blast radius calculation and enforcement
4. **`policy_loader.py`** — Load YAML policy definitions from `../../policy/` directory
5. **`evaluator.py`** — Multi-factor risk evaluation: cost, resource count, environment, action type

## Key Design Decisions

- Policies are **declarative YAML**, not hardcoded logic
- The policy engine is **separate from the LLM** — no prompt injection can bypass it
- Every DENY generates an audit event with the exact reason
- Policies are versioned — you can roll back to a previous policy set
- This is much safer than relying on a prompt saying "Don't delete production databases"
