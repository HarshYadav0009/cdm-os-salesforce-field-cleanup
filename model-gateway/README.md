# Model Gateway — Hot-Swappable Brain

> **Architecture Reference: Sections §13-15 — Model Gateway, §38-40 — Regression & Rollback, §42-43 — Versioning & Drift**

## Why This Folder Exists

Every agent should **not** directly call Claude. If 100 agents hardcode `model = Claude-3.5`, then changing models requires changing 100 agents. That's bad architecture. The Model Gateway provides a single abstraction layer between agents and LLMs.

## Purpose

The Model Gateway handles:

| Responsibility | Description |
|---|---|
| **Model selection** | Route to the right model based on agent config |
| **Token limits** | Enforce per-agent token budgets |
| **Rate limits** | Prevent any single agent from exhausting API quotas |
| **Retries** | Automatic retry with exponential backoff |
| **Fallback models** | If Claude is unavailable, fall back to a backup model |
| **Logging** | Log every model call with full metadata |
| **Cost tracking** | Calculate cost per call (input tokens × rate + output tokens × rate) |
| **Request metadata** | Tag every request with agent ID, task ID, guardian ID |
| **Model versioning** | Version model configs so you can roll back |
| **Safety policies** | Pre-flight data classification, PII redaction |

## Architecture

```
Agent
 ↓
Model Gateway
 ↓
Rate limit check
 ↓
Budget check
 ↓
Data classification / PII redaction
 ↓
Model selection (by agent config)
 ↓
Claude / Bedrock / Future Model
```

## Model Rollback (Section §40)

```
Model Config
v101 → Claude 3.5
v102 → Claude 4.0

If Claude 4.0 has a problem:
v102 → ROLLBACK → v101

The agents don't need to change.
```

## Model Regression Testing (Section §38-39)

Before deploying a new model version:

```
Regression Suite
      │
      ├── Historical Cases
      ├── Security Cases
      │
      ▼
  New Model
      │
      ▼
  Evaluation (multi-dimensional, NOT just text comparison)
      │
      ├── Schema correctness
      ├── Safety compliance
      ├── Semantic equivalence
      ├── Tool selection accuracy
      ├── Action correctness
      ├── Business outcome
      ├── Policy compliance
      ├── Cost
      │
      ▼
  Quality Gate → PASS (deploy) / FAIL (block)
```

## What To Do Here

1. **`gateway.py`** — Core model gateway: route requests to the right LLM
2. **`model_registry.py`** — Track available models, versions, and configurations
3. **`rate_limiter.py`** — Per-agent rate limiting
4. **`cost_tracker.py`** — Calculate and record cost per model call
5. **`data_classifier.py`** — Classify data sensitivity before sending to LLM (Section §37)
6. **`pii_redactor.py`** — Detect and redact PII/sensitive data
7. **`fallback.py`** — Implement model fallback chain
8. **`regression/`** — Model regression test suite

## Data Protection (Section §37)

Before data goes to the LLM:
```
Application Data → Classification → PII Detection → Redaction → Policy → Model Gateway → LLM
```

For highly sensitive data, the policy may simply say: **DO NOT SEND**.

## Key Design Decisions

- **Hot-swappable**: Change `MODEL_VERSION=claude-4` and all agents use the new model without any agent changes
- Cost metering is per-agent, per-task, per-skill, per-guardian, per-business-function (Section §34)
- Model regression tests compare behavior across 8+ dimensions, not just text equality (Section §39)
