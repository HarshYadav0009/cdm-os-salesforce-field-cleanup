# Agents — Individual Agent Implementations

> **Architecture Reference: Sections §24-26 — SRE Agent Example, Multi-Agent Investigation**

## Why This Folder Exists

This is where individual agent **skills** (domain-specific implementations) live. Each subfolder is a self-contained agent that plugs into the Agent Runtime.

## Purpose

Each agent subfolder contains:
- The agent's **skill definition** (what it knows how to do)
- **System instructions** (its personality, constraints, objectives)
- **Tool configurations** (which tools it needs)
- **Test cases** (behavioral evaluation suite)

## Current Agents

| Agent | Domain | Purpose |
|---|---|---|
| `field-cleanup/` | Salesforce / FinOps | Identify and clean up unused Salesforce fields to reduce org complexity and cost |

## Agent Configuration Model (Section §44)

Each agent deployment should be representable as:

```
Agent Deployment
│
├── Agent ID
├── Agent Version
├── Tier
├── Guardian
│
├── Model
│   ├── Provider
│   ├── Model ID
│   └── Parameters
│
├── Skill
│   └── Version
│
├── Prompt
│   └── Version
│
├── Knowledge
│   ├── RAG version
│   └── Precedent policy
│
├── Tools
│   ├── Salesforce API
│   └── ...
│
├── Permissions
├── Blast Radius
└── Policies
```

## What To Do Here

- **To create a new agent**: Create a new subfolder (e.g., `sre-remediation/`, `finops-cost-optimizer/`)
- Each agent folder should contain its own `README.md` documenting its purpose and configuration
- Agent skills are **versioned** — changing the skill, prompt, or tool set changes the agent version

## Drift Detection (Section §43)

Behavior can change if **any** component changes:
- **Model drift** — same agent, different model version
- **Prompt drift** — same agent, different prompt version
- **Knowledge drift** — same agent, different knowledge/RAG version

Therefore, all components are versioned together.
