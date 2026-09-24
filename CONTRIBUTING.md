# Contributing to CDM-OS

Thank you for contributing to **CDM-OS** (Enterprise Control Plane for Autonomous AI Agents).

---

## Architecture Principles to Keep in Mind

When adding features or submitting pull requests, strictly adhere to the **7-Layer Control Plane Architecture**:

1. **Model non-ownership of credentials**: Agents and LLMs *never* receive raw API keys or production database strings. All tools run behind the **Tool Gateway**.
2. **Policy Enforcement at Gateway**: Every tool call must pass through Policy validation (`control-plane/policy/`) before execution.
3. **Deterministic Human-in-the-Loop**: Approval workflows (`workflows/`) must require signed Human-in-the-Loop clearance for Tier 3 actions (e.g. metadata deletion, code modification, structural alterations).
4. **Immutable Audit Logging**: Every proposal, policy check, execution, and output must emit an HMAC-signed audit log entry (`audit/`).

---

## Code Base Organization

| Directory | Layer / Purpose | Contribution Guidelines |
|---|---|---|
| `control-plane/` | Identity, Policy, Database, Registry | Core orchestrator logic. Must maintain high unit test coverage. |
| `model-gateway/` | LLM abstraction & routing | Hot-swappable providers (Anthropic, OpenAI, Azure). Avoid vendor-specific leaks. |
| `tool-gateway/` | MCP Servers & Execution | Sandboxed execution environments for external APIs (Salesforce, GitHub, Jira). |
| `agent-runtime/` | State machines & loops | Agent reasoning loops. Must be stateless across reboots; persistent state stays in DB. |
| `agents/` | Task-specific agent configs | Declarative definitions of agent capabilities & limits. |
| `knowledge/` | RAG, Memory & Precedents | Context retrieval interfaces and vector storage integrations. |
| `policy/` | Policy definitions (YAML) | Security rules, rate limits, action restrictions. |
| `workflows/` | HITL approval flows | YAML workflow definitions for high-risk executions. |
| `infrastructure/` | IaC (Terraform/Helm) | Cloud deployment and container orchestrations. |
| `frontend/` | Governance UI | Control center web app for human approvers. |
| `tests/` | Unit, Integration, Security | Automated verification suites. |

---

## Local Development & Setup

1. **Clone & Set Up Environment**:
   ```bash
   cp .env.example .env
   ```
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run Verification Tests**:
   ```bash
   pytest tests/
   ```

---

## Pull Request Checklist

- [ ] All new tool integrations have a corresponding Policy Rule defined in `policy/definitions/`.
- [ ] Tier 3 tools contain explicit Human-in-the-Loop approval step triggers.
- [ ] No hardcoded secrets or API tokens exist in code or commit history.
- [ ] New components include unit tests under `tests/unit/`.
- [ ] Standard formatting and linting pass clean.
