# CDM-OS — Developer Setup Guide

> This guide gets you from `git clone` to a working local Control Plane API in under 10 minutes.
> **All 3 developers** should follow **Part 1** first, then jump to their own section.

---

## Prerequisites

Before you begin, install these tools on your machine:

| Tool | Version | Check Command | Install |
|---|---|---|---|
| **Git** | 2.40+ | `git --version` | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | 4.25+ | `docker --version` | [docker.com/desktop](https://www.docker.com/products/docker-desktop/) |
| **Python** | 3.11+ | `python --version` | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 20 LTS+ | `node --version` | [nodejs.org](https://nodejs.org/) *(Dev 3 only)* |

> **Windows users**: Make sure Docker Desktop is running and WSL2 is enabled.
> **Mac users**: Docker Desktop should be running in the background.

---

## Part 1: Common Setup (All Developers)

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-org>/rdc-os-salesforce-field-cleanup.git
cd rdc-os-salesforce-field-cleanup
```

### Step 2 — Start Local Infrastructure (Docker Compose)

```bash
# Option A: Start DB & Redis only for local Python dev
docker compose up postgres redis -d

# Option B: Start Full Enterprise Stack (Control Plane + Tool Gateway + DB + Redis)
docker compose up -d

# Verify containers are healthy
docker compose ps
```

You should see:
```
NAME                 STATUS                  PORTS
cdm-postgres         running (healthy)       0.0.0.0:5432->5432/tcp
cdm-redis            running (healthy)       0.0.0.0:6379->6379/tcp
cdm-control-plane    running                 0.0.0.0:8000->8000/tcp
cdm-tool-gateway     running                 0.0.0.0:8080->8080/tcp
```

> **What just happened?**
> - **PostgreSQL** (`localhost:5432`) initialized `cdm_os_db` via `init.sql`.
> - **Control Plane API** (`localhost:8000`) manages agents, proposals, policy enforcement, and audit logs.
> - **Tool Gateway** (`localhost:8080`) hosts the FastMCP Salesforce tool server and bridge endpoints.
> - **Redis** (`localhost:6379`) handles caching and event pub/sub.

### Step 3 — Create Python Virtual Environment & Install Dependencies

```bash
# Create venv
python -m venv .venv

# Activate venv
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies (Control Plane + Tool Gateway)
pip install -r requirements.txt
pip install -r tool-gateway/requirements.txt
```

### Step 4 — Create & Configure Your `.env` File

```bash
cp .env.example .env
```

Update your `.env` for Salesforce Sandbox connectivity (or keep empty for local dry-run testing):
```env
# --- Salesforce Connection ---
SF_LOGIN_URL=https://test.salesforce.com
SF_USERNAME=your-username@domain.com
SF_PASSWORD=your-password
SF_SECURITY_TOKEN=your-token
SF_DOMAIN=test
```

### Step 5 — Run Local API Services (Manual / Standalone Mode)

If running outside Docker Compose, start the services in separate terminals:

```bash
# Terminal 1: Control Plane API (Port 8000)
uvicorn control_plane.main:app --reload --port 8000

# Terminal 2: Tool Gateway API (Port 8080)
uvicorn tool-gateway.gateway.api:app --reload --port 8080
```

---

## 🧪 How to Verify Everything (End-to-End Test)

Run the automated integration test script to verify the full flow:
$$\text{Agent Proposal} \longrightarrow \text{Policy Engine Gate} \longrightarrow \text{Human Decision} \longrightarrow \text{MCP Tool Gateway Execution} \longrightarrow \text{HMAC Audit Log}$$

```bash
# Run automated end-to-end integration test
.\.venv\Scripts\python.exe test_integration.py
```

Expected output:
```
INFO:cdm.policy:Loaded 4 rules from sample_field_cleanup_policy.yaml
INFO:cdm.api.proposals:Proposal created: tool=salesforce_query_field_usage status=POLICY_APPROVED
INFO:cdm.api.proposals:Proposal created: tool=salesforce_delete_field status=PENDING_HUMAN_APPROVAL
INFO:cdm.api.proposals:Proposal APPROVED by admin@enterprise.com -> Status=HUMAN_APPROVED
INFO:cdm.integration_test:Total Audit Trail Entries Logged: 5
✅ INTEGRATION TEST PASSED! All core components connected successfully.
```

---

## 🌐 System Services & Endpoints Reference

| Service | Host & Port | URL / Docs | Purpose |
|---|---|---|---|
| **Control Plane API** | `http://localhost:8000` | [Swagger Docs](http://localhost:8000/docs) | Governance, proposal lifecycle, policy engine |
| **Tool Gateway (MCP)** | `http://localhost:8080` | [Gateway Health](http://localhost:8080/health) | Salesforce MCP tool execution gateway |
| **PostgreSQL Database** | `localhost:5432` | `cdm_os_db` | Agent definitions, proposals, policy rules, audit logs |
| **Redis Event Bus** | `localhost:6379` | `redis://localhost:6379/0` | Cache and pub/sub messaging |
| **React Governance UI** | `http://localhost:5173` | [Governance UI](http://localhost:5173) | Human-in-the-loop approval dashboard |

---

## Daily Workflow Summary

```bash
# 1. Start Infrastructure Stack
docker compose up -d

# 2. Run Test Verification
.\.venv\Scripts\python.exe test_integration.py

# 3. View API & Gateway Logs
docker compose logs -f control-plane tool-gateway
```

