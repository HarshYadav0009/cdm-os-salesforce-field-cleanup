# CDM-OS — Enterprise Control Plane for Autonomous AI Agents

> **Claude/LLM is not the system. CDM-OS is the system that controls what an LLM-powered agent can see, decide, and do.**

---

## What Is This Repository?

This repository implements **CDM-OS**, an enterprise operating architecture for digital labor. It acts as a **policy-driven, identity-aware, event-driven control plane** that sits between AI reasoning (LLM) and real-world execution (AWS, GitHub, Jira, Salesforce, etc.).

### The Core Design Principle

```
The model should NEVER directly own production access.

     LLM                          CDM-OS                      Real World
  ┌──────────┐              ┌───────────────┐              ┌───────────┐
  │ Reason   │  PROPOSAL    │ Who?          │  AUTHORIZED  │ AWS       │
  │ Plan     │ ──────────►  │ Allowed?      │  ACTION      │ Salesforce│
  │ Generate │              │ How risky?    │ ──────────►  │ GitHub    │
  └──────────┘              │ Which policy? │              │ Jira      │
                            │ Human needed? │              └───────────┘
                            └───────────────┘
```

---

## Tech Stack & Prerequisites

| Component | Technology | Purpose |
|---|---|---|
| **Language** | Python 3.11+ | All backend services |
| **Database** | PostgreSQL 17 + pgvector | Agent registry, audit logs, workflow state, vector embeddings |
| **Cache** | Redis | Session state, real-time workflow coordination, event bus |
| **API Framework** | FastAPI | Control Plane REST API |
| **LLM Protocol** | MCP (Model Context Protocol) | Standardized tool access for agents |
| **LLM Provider** | Claude (Anthropic) / AWS Bedrock | Hot-swappable via Model Gateway |
| **IaC** | Terraform | AWS infrastructure provisioning |
| **Containers** | Docker + docker-compose | Local dev + deployment |

---

## Architecture Overview — 7 Layers

```
┌─────────────────────────────────────┐
│ 1. Human & Governance Layer         │  → docs/, frontend/
├─────────────────────────────────────┤
│ 2. Agent Control Plane              │  → control-plane/, policy/, workflows/
├─────────────────────────────────────┤
│ 3. Agent Runtime                    │  → agent-runtime/, agents/
├─────────────────────────────────────┤
│ 4. Intelligence / Model Gateway     │  → model-gateway/
├─────────────────────────────────────┤
│ 5. Knowledge / Memory / Precedents  │  → knowledge/
├─────────────────────────────────────┤
│ 6. Tool & Infrastructure Layer      │  → tool-gateway/, infrastructure/
├─────────────────────────────────────┤
│ 7. Observability / Security / FinOps│  → audit/, tests/
└─────────────────────────────────────┘
```

---

## Full System Architecture (§51)

```
                              HUMAN LAYER
 ┌───────────────────────────────────────────────────────────────────┐
 │ Guardian │ Skill Lead │ AIGB │ Security │ Architecture │ FinOps  │
 └────────────────────────────────┬──────────────────────────────────┘
                                  │
                   Intent / Approval / Override
                                  │
                                  ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                      CDM-OS CONTROL PLANE                        │
 │                                                                  │
 │  Agent Registry │ Policy/Guardrails  │ Lifecycle/Graduation      │
 │  Identity/IAM   │ Workflow/Orchestr. │ Arbitration/Boardroom     │
 │  Audit/Trace    │ Cost/FinOps        │ Kill Switch/Quarantine    │
 └────────────────────────────────┬──────────────────────────────────┘
                                  │
                                  ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                        AGENT RUNTIME                             │
 │    SRE Agents │ FinOps Agents │ Field Cleanup │ Dev Agents │ ... │
 └────────────────────────────────┬──────────────────────────────────┘
                                  │
                                  ▼
                    ┌───────────────────────┐
                    │    MODEL GATEWAY      │
                    │ Claude / Bedrock      │
                    │ Rate limits │ Budgets │
                    │ Fallback │ Versioning │
                    └───────────┬───────────┘
                                │
                                ▼
                          ┌───────────┐
                          │ LLM/Model │
                          └───────────┘

    KNOWLEDGE PLANE                           TOOL PLANE
 ┌──────────────────────┐          ┌──────────────────────────┐
 │ RAG / Documents      │          │ AWS        │ Salesforce  │
 │ Agent Memory         │          │ GitHub     │ Jira        │
 │ Precedents           │          │ Datadog    │ Splunk      │
 │ Runbooks             │          │ Kubernetes │ Slack       │
 └──────────────────────┘          └──────────────────────────┘

                     OBSERVABILITY PLANE
 ┌───────────────────────────────────────────────────────────────────┐
 │ Logs │ Metrics │ Traces │ Token Cost │ Drift │ Security │ Audit  │
 └───────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Flow Example (§50)

> Human says: *"Reduce unused development AWS resources."*

| Step | What Happens | Component |
|---|---|---|
| **1. Intent** | Human → CDM-OS → Task created | `control-plane/api/` |
| **2. Agent Selection** | Task → FinOps Agent selected | `control-plane/agents/` |
| **3. Context** | Agent retrieves AWS data + policies + precedents + budget | `knowledge/`, `policy/` |
| **4. Planning** | Agent proposes: "Stop 10 underutilized instances, save $7,200/mo" | `agent-runtime/`, `model-gateway/` |
| **5. Policy Check** | PDP evaluates: agent allowed? env allowed? cost within threshold? | `control-plane/policy/` |
| **6. Arbitration** | SRE says 3 instances needed → Digital Boardroom resolves | `control-plane/workflow/` |
| **7. Authorization** | Policy → ephemeral AWS IAM credential issued | `control-plane/identity/` |
| **8. Execution** | AWS API → stop 7 resources | `tool-gateway/` |
| **9. Verification** | Agent checks: resources stopped? no critical service affected? | `agent-runtime/` |
| **10. Audit** | Immutable log: who, why, policy, precedent, model, action, result | `control-plane/audit/` |
| **11. Metrics** | Task cost: $0.82 │ AWS savings: $600/mo │ Human time saved: 45 min | `audit/` |

---

## Folder Structure

```
cdm-os-salesforce-field-cleanup/
│
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Local dev stack (PostgreSQL + pgvector, Redis)
├── requirements.txt              # Root Python dependencies
├── CONTRIBUTING.md               # How to contribute, coding standards, PR process
├── README.md                     # ← You are here
│
├── control-plane/                # LAYER 2 — The brain of CDM-OS
│   ├── agents/                   #   Agent Registry ("Active Directory for AI agents")
│   ├── identity/                 #   Agent Identity & IAM, ephemeral credentials
│   ├── policy/                   #   Policy Decision Point (PDP) engine
│   ├── workflow/                 #   Durable state machine / workflow engine
│   ├── approvals/                #   Tier-based human approval routing
│   ├── audit/                    #   Immutable audit event writer
│   ├── api/                      #   FastAPI REST endpoints
│   ├── database/                 #   PostgreSQL schemas & migrations
│   └── tool-gateway/             #   Internal tool routing
│
├── agent-runtime/                # LAYER 3 — Controlled execution sandbox
│
├── agents/                       # LAYER 3 — Individual agent implementations
│   └── field-cleanup/            #   Salesforce field cleanup agent
│
├── model-gateway/                # LAYER 4 — Hot-swappable LLM abstraction
│
├── knowledge/                    # LAYER 5 — Agent intelligence store
│   └── rag/                      #   RAG pipeline, embeddings, vector store
│
├── tool-gateway/                 # LAYER 6 — Policy-enforced external access
│   ├── mcp-gateway/              #   MCP routing & policy enforcement
│   └── servers/                  #   Individual MCP tool servers
│       └── salesforce/           #     Salesforce MCP server
│
├── infrastructure/               # LAYER 6 — IaC & deployment
│   ├── terraform/                #   AWS infrastructure modules
│   ├── iam/                      #   Ephemeral IAM role templates
│   ├── event-bus/                #   EventBridge, SQS, SNS configs
│   └── containers/               #   Dockerfiles & ECS task definitions
│
├── policy/                       # Policy definitions (YAML)
│   ├── global.yaml               #   Global rules for all agents
│   ├── tiers/                    #   Tier 1/2/3 specific rules
│   ├── agents/                   #   Per-agent blast radius configs
│   └── domains/                  #   Domain-wide policies (SRE, FinOps, etc.)
│
├── workflows/                    # Workflow definitions (YAML state machines)
│
├── audit/                        # LAYER 7 — Observability & reporting
│   ├── schemas/                  #   Audit event JSON schemas
│   ├── exporters/                #   Datadog, Splunk, CloudWatch exporters
│   └── dashboards/               #   Grafana/Datadog dashboard configs
│
├── tests/                        # LAYER 7 — All test suites
│   ├── unit/                     #   Unit tests per module
│   ├── integration/              #   Cross-component integration tests
│   ├── regression/               #   Model regression test suite
│   └── evaluation/               #   Agent behavior evaluation
│
├── docs/                         # LAYER 1 — Human documentation
│   ├── architecture/             #   Technical architecture docs
│   ├── governance/               #   Governance handbooks
│   ├── runbooks/                 #   Manual fallback procedures
│   └── onboarding/               #   Getting started guides
│
└── frontend/                     # LAYER 1 — Guardian dashboard UI
```

---

## Security Model (§35)

```
Identity → Authorization → Policy Engine
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
                 Network               Data
                 Controls             Controls
                    │                     │
                    └──────────┬──────────┘
                               ▼
                          Tool Gateway
                               │
                               ▼
                            Target
```

All access is:
- **Identity-verified** — every agent has a unique, auditable identity
- **Policy-evaluated** — deterministic rules, not LLM judgment
- **Time-limited** — ephemeral credentials with auto-expiry
- **Fully logged** — immutable audit trail for every action

---

## Tier System — Agent Autonomy Levels

| Tier | Autonomy | Approval | Example |
|---|---|---|---|
| **Tier 1** | None — output only | Every action requires human review | Agent generates a PR; human merges |
| **Tier 2** | Plan-level | Human approves the plan | Agent proposes "stop 10 instances"; human approves |
| **Tier 3** | Autonomous within policy | Policy engine decides | Agent auto-remediates within blast radius |

**Graduation**: Tier 1 → 2 → 3 requires AIGB approval, evaluation tests, shadow mode, and regression pass.

---

## Getting Started

```bash
# 1. Clone and setup environment
git clone <repo-url>
cd cdm-os-salesforce-field-cleanup
cp .env.example .env                    # Configure your environment

# 2. Start local infrastructure
docker-compose up -d                     # PostgreSQL + pgvector, Redis

# 3. Install Python dependencies
python -m venv .venv
.venv/Scripts/activate                   # Windows
pip install -r requirements.txt

# 4. Run the control plane API (from project root)
uvicorn control_plane.main:app --reload --port 8000

# 5. Run tests
pytest
```

---

## Key Concepts

| Concept | Definition |
|---|---|
| **Guardian** | Human responsible for an individual agent or agent pod |
| **Skill Lead** | Human responsible for a domain (e.g., SRE Skill Lead) |
| **AIGB** | AI Governance Board — approves Tier 3 graduation, high-risk capabilities, global policies |
| **Tier System** | Tier 1 (generate → PR → human review), Tier 2 (plan → human approval → execute), Tier 3 (autonomous within policy) |
| **PDP** | Policy Decision Point — every agent action is evaluated: ALLOW / DENY / ESCALATE |
| **Blast Radius** | Machine-readable limits on what an agent can affect (max resources, max cost, allowed envs) |
| **Digital Boardroom** | Arbitration mechanism when agents disagree (e.g., SRE says scale up, FinOps says scale down) |
| **Kill Switch** | Centralized stop mechanism — individual agent, pod, capability, or global emergency stop |
| **Hot-Swappable Brain** | Model Gateway abstraction — change `MODEL_VERSION=claude-4` without touching any agent |
| **Agent Multiplier** | Metric: does the agent save more value than it costs? (Task cost vs. human time saved) |
| **Drift** | Behavioral change from model/prompt/knowledge updates — detected by regression tests |
| **Precedent** | Historical decision with TTL — agents reference but don't blindly follow |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines, coding standards, and PR process.
