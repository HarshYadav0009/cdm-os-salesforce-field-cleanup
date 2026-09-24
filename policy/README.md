# Global Policy Definitions — Declarative Guardrails

> **Architecture Reference: Sections §6-8 — Policy Engine, Blast Radius Configuration**

## Why This Folder Exists

Policies should be **declarative data** (YAML files), not hardcoded logic scattered across the codebase. This folder is the central repository for all policy definitions that the Policy Engine (in `control-plane/policy/`) loads and enforces.

## Purpose

Store machine-readable policy definitions that govern what every agent can and cannot do. The Policy Engine reads these files and uses them to make ALLOW / DENY / ESCALATE decisions.

## What To Do Here

1. **`global.yaml`** — Global policies that apply to all agents (e.g., "no agent may modify IAM in production")
2. **`tiers/`** — Tier-specific policy definitions:
   - `tier1.yaml` — Tier 1 constraints (output is always a proposal, never autonomous execution)
   - `tier2.yaml` — Tier 2 constraints (plan approval required)
   - `tier3.yaml` — Tier 3 constraints (autonomous within guardrails)
3. **`agents/`** — Per-agent blast radius configurations:
   - `finops-dev-007.yaml`
   - `sre-prod-007.yaml`
   - `salesforce-field-cleanup-001.yaml`
4. **`domains/`** — Domain-wide policies:
   - `sre.yaml` — SRE domain rules
   - `finops.yaml` — FinOps domain rules
   - `engineering.yaml` — Engineering domain rules
5. **`actions/`** — Action-specific policies:
   - `destructive_actions.yaml` — Extra guards for DELETE, DROP, TERMINATE operations
   - `cost_thresholds.yaml` — Maximum cost per operation by tier/environment

## Example Policy File

```yaml
# agents/finops-dev-007.yaml
agent: finops-dev-007
tier: 2
guardian: EMP-123

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

escalation:
  - action: delete_*
    require: guardian_approval
  - environment: production
    require: aigb_approval
```

## Key Design Decisions

- Policies are **version-controlled** in Git — every change is tracked, reviewable, and rollbackable
- The Policy Engine in `control-plane/policy/` loads these files at startup and on config change
- Policy changes require PR review (policies are code-reviewed like application code)
- Policies are **composable** — global + tier + domain + agent-specific policies are merged in order of specificity
