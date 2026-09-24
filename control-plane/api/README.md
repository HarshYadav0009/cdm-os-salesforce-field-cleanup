# Control Plane API — External Interface

> **Architecture Reference: Exposes all Control Plane services to Agent Runtime, Frontend, and external integrations**

## Why This Folder Exists

The Control Plane needs a well-defined API surface so that:
- The **Agent Runtime** can request policy evaluations, register actions, fetch configurations
- The **Frontend Dashboard** can display agent status, approve requests, view audit logs
- **External systems** (CI/CD, monitoring) can trigger workflows or query agent state

## Purpose

This folder contains the REST/gRPC API endpoints that expose every Control Plane capability.

## API Endpoint Map

| Endpoint Group | Service | Purpose |
|---|---|---|
| `/agents` | Agent Registry | CRUD for agent records, status queries, kill switch |
| `/identity` | Identity & IAM | Issue credentials, rotate tokens, revoke access |
| `/policy` | Policy Engine | Evaluate proposed actions, get applicable policies |
| `/policy/evaluate` | PDP | Real-time policy decision: ALLOW / DENY / ESCALATE |
| `/workflows` | Workflow Engine | Create, query, transition workflow state |
| `/approvals` | Approval System | Create approval requests, approve/reject, query pending |
| `/audit` | Audit Log | Query audit events, replay decision chains |
| `/arbitration` | Digital Boardroom | Submit conflicts, get arbitration decisions |

## What To Do Here

1. **`app.py`** — FastAPI application setup, middleware, CORS, error handling
2. **`routes/`** — One route file per service (agents.py, policy.py, workflows.py, etc.)
3. **`middleware/`** — Authentication, request logging, rate limiting
4. **`schemas/`** — API request/response Pydantic models

## Key Design Decisions

- All API calls are authenticated (agent identity or human identity)
- All API calls are logged to the audit trail
- The `/policy/evaluate` endpoint is the most latency-sensitive — it's in the critical path of every agent action
- API versioning from day one (e.g., `/v1/agents`)
