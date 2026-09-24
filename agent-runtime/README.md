# Agent Runtime — The Container Where Agents Live

> **Architecture Reference: Sections §9-12 — Agent Runtime, Tier Runtimes**

## Why This Folder Exists

An agent should **not** simply run arbitrary code on a developer laptop. It should operate inside a **controlled runtime** — a sandbox that provides the agent with exactly the services it needs and nothing more.

## Purpose

The Agent Runtime is the execution environment for every agent. Think of it as the "container" that wraps the LLM with everything it needs:

```
Agent Runtime
│
├── System Instructions      → What the agent is supposed to do
├── Skill                    → Domain-specific capabilities
├── Context                  → Retrieved knowledge, precedents, current state
├── Model Client             → Connection to the Model Gateway (not direct to Claude)
├── Tool Client              → Connection to the Tool Gateway (not direct to AWS)
├── Memory Client            → Working state, conversation history
└── Policy Client            → Real-time policy checks before every action
```

## Tier-Based Runtime Behavior

### Tier 1 Runtime (Section §10)
```
Agent → Generate → PR → Human Review → Merge
```
No autonomous production execution. Output is always a proposal.

### Tier 2 Runtime (Section §11)
```
Intent → Plan → Policy validation → Human approval → Agent execution → Validation → Report
```
The human approves the plan before execution.

### Tier 3 Runtime (Section §12)
```
Trigger → Agent → Plan → Policy Engine → Risk Evaluation → Execute → Verify → Audit → Report
```
Autonomous within policy. If policy says ESCALATE, it pauses for humans.

## What To Do Here

1. **`runtime.py`** — Core runtime class that bootstraps an agent with all its clients
2. **`skill_loader.py`** — Load and validate agent skills (domain-specific instructions)
3. **`context_builder.py`** — Assemble the agent's context from RAG, precedents, working state
4. **`model_client.py`** — Client for the Model Gateway (never calls Claude directly)
5. **`tool_client.py`** — Client for the Tool Gateway (never calls AWS directly)
6. **`memory_client.py`** — Manages working state across multi-step tasks
7. **`policy_client.py`** — Real-time policy check client (calls the PDP before each action)
8. **`tier_enforcer.py`** — Enforce tier-specific behavior (Tier 1 = proposal only, Tier 2 = plan approval, Tier 3 = policy-gated)

## Key Design Decisions

- The runtime is the **only** path to tools and models — agents cannot bypass it
- Runtime configuration is loaded from the Agent Registry at startup
- The runtime enforces the tier system — an agent cannot self-promote to a higher tier
- Every runtime instance logs telemetry: token usage, tool calls, retries, latency
