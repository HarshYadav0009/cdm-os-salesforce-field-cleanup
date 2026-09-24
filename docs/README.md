# Documentation — Architecture, Governance, and Human Runbooks

> **Architecture Reference: Layer 1 — Human & Governance, §47 — Manual Override**

## Why This Folder Exists

Humans are at the top of the architecture. They need documentation for:
- Understanding the system architecture
- Governance standards and procedures
- **Manual runbooks** as fallback when CDM-OS fails (Section §47)
- Onboarding new guardians and skill leads

## Purpose

Central documentation hub for the CDM-OS platform.

## What To Do Here

1. **`architecture/`** — Technical architecture documentation
   - `overview.md` — The 7-layer architecture overview
   - `control-plane.md` — Control plane deep dive
   - `agent-runtime.md` — Agent runtime specification
   - `model-gateway.md` — Model gateway specification
   - `security.md` — Security architecture (Section §35)
   - `event-architecture.md` — Event-driven design (Section §28)
   - `data-flow.md` — End-to-end data flow diagrams

2. **`governance/`** — Governance documentation
   - `tier-system.md` — Tier 1/2/3 definitions and graduation criteria
   - `guardian-handbook.md` — What a Guardian is responsible for
   - `skill-lead-handbook.md` — What a Skill Lead is responsible for
   - `aigb-procedures.md` — AIGB meeting procedures, approval workflows
   - `agent-review-checklist.md` — Checklist for reviewing agent behavior

3. **`runbooks/`** — Manual fallback procedures (Section §47)
   - `manual-override.md` — How to manually override an agent
   - `kill-switch.md` — How to use the kill switch (individual, pod, capability, global)
   - `disaster-recovery.md` — DR procedures (Section §48)
   - `credential-rotation.md` — Manual credential rotation procedures
   - `rollback-model.md` — How to roll back a model version

4. **`onboarding/`** — Getting started guides
   - `new-guardian.md` — Onboarding a new agent guardian
   - `new-agent.md` — Creating and deploying a new agent
   - `new-mcp-server.md` — Adding a new tool integration

## Key Design Decisions

- **Manual runbooks are mandatory** — every automated capability must have a human fallback
- Documentation is versioned alongside code in Git
- Architecture docs use the same terminology as the codebase (Agent Registry, PDP, Blast Radius, etc.)
- Governance docs are reviewed and approved by AIGB
