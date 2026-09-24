# Database — PostgreSQL Schemas & Migrations

> **Architecture Reference: Underpins Agent Registry, Audit Log, Workflow State, Policy Store, Precedent Store**

## Why This Folder Exists

All persistent state in CDM-OS lives in PostgreSQL (with pgvector for embeddings). This folder contains the database schema definitions, migrations, and seed data.

## Purpose

Define and manage the database schema for all control plane data:

- **Agent Registry** — agent records, guardian assignments, tier tracking
- **Agent Identity** — identity certificates, IAM role mappings
- **Policy Store** — policy rules, blast radius configs
- **Workflow State** — task state machines, retry counters, checkpoints
- **Approval Queue** — pending approvals, approval history
- **Audit Log** — immutable append-only event log
- **Precedent Store** — historical decisions with TTLs

## What To Do Here

1. **`migrations/`** — Alembic migration files for schema evolution
2. **`schemas/`** — SQLAlchemy model definitions for each table
3. **`seed/`** — Initial seed data (default policies, sample agent records)
4. **`connection.py`** — Database connection pool configuration (connects to `docker-compose.yml` PostgreSQL)

## Connection Details (Local Dev)

From `docker-compose.yml`:
```
Host: localhost
Port: 5432
User: cdm_os
Password: cdm_Admin
Database: cdm_paaword
```

## Key Tables

| Table | Purpose |
|---|---|
| `agents` | Agent registry records |
| `agent_identities` | Agent identity & IAM mappings |
| `policies` | Policy rule definitions |
| `blast_radius_configs` | Per-agent blast radius limits |
| `workflows` | Workflow instance state |
| `workflow_steps` | Individual step execution records |
| `approvals` | Approval requests and decisions |
| `audit_events` | Immutable audit log (append-only) |
| `precedents` | Historical decisions with TTLs and applicability |
| `model_configs` | Model version configurations |

## Key Design Decisions

- Audit events table uses `INSERT ONLY` permissions — no UPDATE or DELETE
- pgvector extension is available for RAG/knowledge embedding storage
- Redis (from docker-compose) is used for caching and real-time workflow state
