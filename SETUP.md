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

### Step 2 — Start Local Infrastructure (PostgreSQL + Redis)

```bash
# Start database and cache containers (first run downloads images ~500MB)
docker compose up postgres redis -d

# Verify containers are healthy
docker compose ps
```

You should see:
```
NAME             STATUS                  PORTS
cdm-postgres     running (healthy)       0.0.0.0:5432->5432/tcp
cdm-redis        running (healthy)       0.0.0.0:6379->6379/tcp
```

> **What just happened?**
> - PostgreSQL is running on `localhost:5432` with the `cdm_os_db` database.
> - The `init.sql` script automatically created all tables and seeded 7 Salesforce tool definitions.
> - Redis is running on `localhost:6379` for caching and event pub/sub.

### Step 3 — Create Python Virtual Environment

```bash
# Create venv
python -m venv .venv

# Activate it
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Windows (CMD):
.\.venv\Scripts\activate.bat
# macOS/Linux:
source .venv/bin/activate
```

### Step 4 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 5 — Create Your `.env` File

```bash
# Copy the template
cp .env.example .env
```

> The defaults in `.env.example` already match the `docker-compose.yml` settings.
> No changes are needed for basic local development.

### Step 6 — Verify the Control Plane Starts

```bash
# Start the API server
uvicorn control_plane.main:app --reload --port 8000
```

You should see:
```
CDM-OS Control Plane starting up
  Environment : development
  Policy mode : enforce
  Database    : localhost:5432/cdm_os_db
Policy Engine loaded 4 rules
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 7 — Test the API

Open your browser and go to:
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

Or use `curl`:
```bash
# Health check
curl http://localhost:8000/health

# List seeded tools
curl http://localhost:8000/api/v1/tools

# Register an agent
curl -X POST http://localhost:8000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_sf_field_cleanup_v1",
    "name": "Salesforce Field Cleanup Agent",
    "description": "Autonomous field deprecation agent"
  }'

# Submit a proposal (will trigger Policy Engine)
curl -X POST http://localhost:8000/api/v1/proposals \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_sf_field_cleanup_v1",
    "tool_id": "salesforce_describe_object",
    "input_payload": {"object_name": "Account"}
  }'
```

✅ **You're now set up.** The Control Plane API is running, connected to the database, and the Policy Engine is loaded.

---

## Part 2: Dev 2 — Tool Gateway & Salesforce MCP Setup

After completing Part 1, you can start building Salesforce MCP tool servers.

### Your Workspace

Your primary directories:
```
tool-gateway/
  servers/                  ← Create MCP server files here
  mcp-gateway/              ← Gateway routing logic
agents/
  field-cleanup/
    config.yaml             ← Already created, update as needed
```

### Extra Dependencies

Add to your local venv:
```bash
pip install simple-salesforce
```

### Connecting to Salesforce Sandbox

1. Sign up for a free Salesforce Developer Sandbox: [developer.salesforce.com/signup](https://developer.salesforce.com/signup)
2. Update your `.env` file:
   ```env
   SF_LOGIN_URL=https://test.salesforce.com
   SF_USERNAME=your-email@sandbox.com
   SF_CONSUMER_KEY=your-connected-app-key
   SF_PRIVATE_KEY_PATH=./config/certs/salesforce.key
   ```

### How Your Code Integrates

Your MCP tools will be **called by the Control Plane** after a proposal is approved:

```
Agent proposes tool call
        │
        ▼
Control Plane API (POST /api/v1/proposals)
        │
        ▼
Policy Engine evaluates → ALLOWED / DENIED / NEEDS_HITL
        │
        ▼
If approved → Control Plane calls YOUR MCP Server
        │
        ▼
Your MCP server executes against Salesforce and returns result
```

### Key API Endpoints You'll Use

| Endpoint | What For |
|---|---|
| `GET /api/v1/tools` | Verify your tools are registered |
| `POST /api/v1/proposals` | Submit test proposals to see the policy engine in action |
| `GET /api/v1/proposals/{id}` | Check proposal status after submission |

---

## Part 3: Dev 3 — Governance UI & Frontend Setup

After completing Part 1, you can start building the React Governance UI.

### Your Workspace

Your primary directories:
```
frontend/                   ← React/Vite app lives here
workflows/                  ← YAML workflow definitions
audit/                      ← Audit log viewer data
```

### Initialize the Frontend

```bash
cd frontend
npx -y create-vite@latest . --template react-ts

# Install dependencies
npm install

# Install API client library
npm install axios

# Start dev server (runs on http://localhost:5173)
npm run dev
```

> The Control Plane API already has CORS configured to accept requests from `localhost:5173`.

### Key API Endpoints You'll Use

| Endpoint | What For |
|---|---|
| `GET /api/v1/proposals/queue/pending` | **Primary endpoint** — fetch proposals awaiting human approval |
| `PUT /api/v1/proposals/{id}/decide` | Submit human APPROVE / REJECT decisions |
| `GET /api/v1/proposals` | List all proposals with filtering |
| `GET /api/v1/audit` | Fetch audit trail for compliance view |
| `GET /api/v1/agents` | Show registered agents in the dashboard |
| `GET /api/v1/tools` | Show registered tools and their tier badges |

### API Response Shape (for UI rendering)

A pending proposal response looks like:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "agent_id": "agent_sf_field_cleanup_v1",
  "tool_id": "salesforce_delete_field",
  "status": "PENDING_HUMAN_APPROVAL",
  "tier": "Tier-3",
  "input_payload": {
    "object_name": "Account",
    "field_api_name": "Legacy_Code__c"
  },
  "policy_result": {
    "allowed": true,
    "requires_human_approval": true,
    "matched_rules": ["rule_require_hitl_for_deletion"]
  },
  "created_at": "2026-09-24T12:00:00Z"
}
```

To approve a proposal:
```bash
curl -X PUT http://localhost:8000/api/v1/proposals/<id>/decide \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "APPROVED",
    "reviewer_email": "admin@company.com",
    "reason": "Field confirmed unused across all environments"
  }'
```

---

## Troubleshooting

### Docker containers won't start
```bash
# Stop everything and remove volumes
docker compose down -v
# Restart fresh
docker compose up postgres redis -d
```

### Database connection error
- Make sure Docker Desktop is running
- Check ports: `docker compose ps`
- Verify `.env` matches `docker-compose.yml` credentials

### `ModuleNotFoundError: No module named 'control_plane'`
Make sure you're running from the **project root directory** (where `control_plane/` folder lives):
```bash
cd d:\rdc-os-salesforce-field-cleanup
uvicorn control_plane.main:app --reload
```

### Policy Engine loaded 0 rules
- Check that `policy/definitions/` directory contains `.yaml` files
- Check the `POLICY_DEFINITIONS_PATH` in your `.env`

---

## Daily Workflow

```bash
# 1. Start infrastructure (if containers stopped)
docker compose up postgres redis -d

# 2. Activate venv
.\.venv\Scripts\Activate.ps1     # Windows
source .venv/bin/activate         # macOS/Linux

# 3. Start the API
uvicorn control_plane.main:app --reload --port 8000

# 4. Your specific work...
#    Dev 2: work in tool-gateway/servers/
#    Dev 3: cd frontend && npm run dev
```
