# Knowledge / Memory / Precedents — Agent Intelligence Store

> **Architecture Reference: Sections §16-21 — Memory Architecture, Working State, RAG, Precedent Store**

## Why This Folder Exists

Agents need context to make good decisions. That context comes from multiple sources: documentation, runbooks, historical decisions (precedents), and working memory. These should **not** all be crammed into one database or treated as one monolithic system.

## Purpose

This folder implements five distinct memory subsystems:

```
Agent Memory
│
├── Configuration       → Agent settings (loaded from Agent Registry)
├── Working State       → Current task progress, checkpoints
├── Long-Term Knowledge → RAG: docs, runbooks, APIs, engineering standards
├── Precedents          → Historical decisions with TTLs and applicability
└── Audit History       → Past actions and outcomes (read from audit log)
```

## RAG / Knowledge Store (Section §19)

The agent may need access to:
- Architecture documentation
- Runbooks
- API specifications
- Engineering standards
- Historical incidents
- Approved designs

```
Documents → Embedding → Vector Store (pgvector) → Retriever → Agent Context
```

## Precedent Store (Section §20-21)

Precedents are **historical decisions** that agents can reference — but they should **never** automatically become instructions.

```json
{
  "precedentId": "PRE-2026-00421",
  "domain": "SRE",
  "decision": "Do not reduce capacity below X during peak traffic",
  "approvedBy": "EMP-123",
  "createdAt": "2026-01-12",
  "expiresAt": "2026-07-12",
  "status": "ACTIVE"
}
```

### ⚠️ Critical Safeguard (Section §21)

**Precedents should NOT automatically become instructions.**

```
✗ WRONG:  Precedent → LLM → Execute

✓ RIGHT:  Precedent → Retrieve → Validate status → Check TTL
          → Check applicability → Add to context
          → Agent proposes decision → Policy engine validates
```

Stale precedents can become dangerous if blindly followed.

## What To Do Here

1. **`rag/`** — RAG pipeline: document ingestion, embedding generation, vector store (pgvector), retrieval
2. **`precedent_store.py`** — CRUD for precedents with TTL enforcement and applicability checks
3. **`working_state.py`** — Durable working memory for in-progress tasks
4. **`memory_service.py`** — Unified memory interface that agents query through the runtime
5. **`embeddings.py`** — Embedding generation service (for vectorizing documents)

## Key Design Decisions

- **Working state** is durable (PostgreSQL), not in the LLM's context window (Section §18)
- **Precedents** have TTLs and must be validated before use
- **RAG documents** are versioned — knowledge version changes count as "knowledge drift" (Section §43)
- **pgvector** extension (already available via docker-compose) is used for embedding storage
