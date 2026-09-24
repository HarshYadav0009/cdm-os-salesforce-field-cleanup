# Tests — Unit, Integration, Regression, and Agent Evaluation

> **Architecture Reference: Sections §38-41 — Model Regression, Agent CI/CD**

## Why This Folder Exists

CDM-OS has **two different CI/CD pipelines** that both need tests:

### Software CI/CD (traditional)
```
Code → Build → Test → Deploy
```

### Agent CI/CD (behavior evaluation)
```
Prompt/Skill/Tools/Model → Behavior Evaluation → Security Evaluation → Regression → Shadow → Deploy
```

## Purpose

This folder contains all test suites for the entire CDM-OS system:

## What To Do Here

1. **`unit/`** — Unit tests for individual modules
   - `test_policy_engine.py` — Does the PDP correctly ALLOW/DENY/ESCALATE?
   - `test_agent_registry.py` — CRUD operations on agent records
   - `test_blast_radius.py` — Blast radius calculation and enforcement
   - `test_workflow_engine.py` — State machine transitions and retry logic

2. **`integration/`** — Integration tests across components
   - `test_agent_lifecycle.py` — Full lifecycle: register → activate → execute → audit
   - `test_policy_workflow.py` — Agent proposes action → policy evaluates → approval flows → execution
   - `test_tool_gateway.py` — Agent → Tool Gateway → MCP Server → External System

3. **`regression/`** — Model regression tests (Section §38-39)
   - `test_model_regression.py` — Compare behavior across model versions
   - `historical_cases/` — Saved input/output pairs from production
   - `security_cases/` — Adversarial inputs that must be handled correctly
   - Multi-dimensional comparison (not just text equality):
     1. Schema correctness
     2. Security compliance
     3. Authorization correctness
     4. Tool selection accuracy
     5. Action correctness
     6. Business outcome
     7. Policy compliance
     8. Cost impact

4. **`evaluation/`** — Agent behavior evaluation
   - `eval_field_cleanup.py` — Does the field cleanup agent correctly identify unused fields?
   - `eval_safety.py` — Does the agent refuse to perform dangerous actions?
   - `eval_policy_compliance.py` — Does the agent respect its blast radius?

5. **`shadow/`** — Shadow mode testing
   - Run agents against real data but don't execute actions
   - Compare proposed actions against expected outcomes

## Key Design Decisions

- Regression tests compare **behavior**, not just text output (Section §39)
- Agent evaluation tests are part of the Agent CI/CD pipeline, not just software CI/CD
- Shadow mode testing happens before any agent promotion to a higher tier
- All test results are logged for governance and compliance
