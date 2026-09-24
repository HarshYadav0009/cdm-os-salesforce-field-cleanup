# Agent Identity & IAM — Secure Agent Credentials

> **Architecture Reference: Sections §4-5 — Agent Identity, §36 — Ephemeral Credentials**

## Why This Folder Exists

Every agent needs a **unique, auditable identity** that is separate from any human's identity. Without this, you cannot trace who did what, enforce per-agent permissions, or revoke access when something goes wrong.

## Purpose

This folder implements:

1. **Agent Identity Issuance** — Each agent gets a unique ID and identity certificate
2. **IAM Role Management** — Agents assume ephemeral IAM roles, not permanent credentials
3. **Credential Lifecycle** — Short-lived tokens that auto-expire after each task

## Architecture: Why Agent Identity ≠ Human Identity

```
Human
  │
  │ owns
  ▼
Agent Identity
  │
  │ assumes
  ▼
Ephemeral IAM Role
  │
  ▼
AWS Resource
```

This gives you:
- **Human accountability** — every agent traces back to a guardian
- **Machine identity** — the agent is its own entity for audit purposes
- **Short-lived authorization** — credentials expire, reducing blast radius of compromise

## Example Identity

```
Agent ID:      SRE-PROD-007
Guardian:      EMP-123
IAM Role:      cdmos-sre-prod-007
Tier:          3
Credential:    Ephemeral (15-minute TTL)
```

## What To Do Here

1. **`identity_service.py`** — Issue and manage agent identities (create, rotate, revoke)
2. **`iam_manager.py`** — Assume ephemeral IAM roles via AWS STS for each agent task
3. **`credential_provider.py`** — Vend short-lived credentials; enforce automatic expiration
4. **`identity_schema.py`** — Define the identity data model

## Ephemeral Credential Flow (Section §36)

```
Agent starts task
      ↓
Requests IAM role
      ↓
Policy validates request
      ↓
Temporary credential issued (e.g., 15-min TTL)
      ↓
AWS operation executes
      ↓
Credential expires automatically
```

## Key Design Decisions

- **Never** let the agent use a human's credentials
- **Never** issue permanent/long-lived credentials to agents
- Every credential issuance is an auditable event
- Identity follows the agent everywhere (all logs, all tool calls, all audit records)
