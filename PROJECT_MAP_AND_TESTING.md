# CDM-OS — Project File Map & Testing Guide

> **Enterprise Control Plane for Autonomous AI Agents**  
> Complete architecture reference, file contents guide, and step-by-step testing instructions.

---

## 1. Directory & File Map — What File Contains What

Below is the complete blueprint of the `d:\rdc-os-salesforce-field-cleanup` repository.

```
d:\rdc-os-salesforce-field-cleanup\
├── .env.example                 # Template for environment variables (DB host, Redis, secrets)
├── .gitignore                   # Excludes venv, pycache, secrets, logs, node_modules
├── Dockerfile                   # Docker image definition for Python 3.12 FastAPI Control Plane
├── docker-compose.yml           # Multi-container local orchestration (PostgreSQL 17, Redis 7, API)
├── requirements.txt             # Python dependencies (FastAPI, SQLAlchemy, PyYAML, pytest, etc.)
├── pytest.ini                   # Pytest configuration (pythonpath, testpaths)
├── SETUP.md                     # Onboarding guide for 3-developer team (Dev 1, Dev 2, Dev 3)
├── CONTRIBUTING.md              # Code conventions, security rules, and PR checklist
├── README.md                    # System architecture overview & executive summary
│
├── control_plane/               # Python package for Control Plane backend
│   ├── __init__.py              # Package marker
│   ├── main.py                  # FastAPI server entry point, CORS, lifespan startup/shutdown hooks
│   ├── config.py                # Environment configuration settings using Pydantic Settings
│   ├── database.py              # SQLAlchemy engine, session maker, get_db dependency
│   ├── models.py                # SQLAlchemy ORM models (Agent, ToolDefinition, Proposal, AuditLog, PolicyRule)
│   ├── schemas.py               # Pydantic DTOs for REST API requests & responses
│   ├── policy_engine.py         # Security gatekeeper: loads YAML policies & evaluates tool call proposals
│   ├── audit.py                 # HMAC-SHA256 event signer and tamper verification module
│   └── routes/                  # API endpoints
│       ├── __init__.py          # Exports all router instances
│       ├── proposals.py         # Proposal submission, evaluation, listing, and human decision endpoints
│       ├── agents.py            # Agent registration, listing, and status management
│       ├── tools.py             # Tool catalog and tier definition listing
│       └── audit.py             # Audit log querying and tamper verification API
│
├── control-plane/               # Architecture docs & DB schema initialization
│   ├── README.md                # Control Plane architecture documentation
│   └── database/
│       ├── README.md            # DB schema architecture documentation
│       └── init.sql             # SQL script: ENUMs, tables, indexes, and seeded Salesforce tools
│
├── policy/                      # Declarative policy definition layer
│   ├── README.md                # Policy architecture documentation
│   └── definitions/             # YAML policy files loaded by PolicyEngine at startup
│       └── sample_field_cleanup_policy.yaml  # Field deletion security guardrails & HITL rules
│
├── workflows/                   # Human-in-the-Loop approval workflow definitions
│   ├── README.md                # Workflow architecture documentation
│   └── sample_deletion_approval_workflow.yaml # 6-step HITL workflow spec
│
├── tool-gateway/                # Model Context Protocol (MCP) gateway architecture
│   ├── README.md                # MCP gateway overview
│   ├── mcp-gateway/             # MCP server implementation for Salesforce
│   │   └── README.md            # Salesforce MCP gateway documentation
│   └── servers/                 # Specific tool servers
│       └── salesforce/          # Salesforce metadata & tooling API integration
│           └── README.md        # Salesforce MCP server details
│
├── frontend/                    # Governance UI (React / Vite)
│   ├── README.md                # Governance dashboard documentation
│   └── governance-ui/           # React single-page application source
│       └── README.md            # React app documentation
│
├── agents/                      # Registered Autonomous Agent configurations
│   ├── README.md                # Agent runtime architecture documentation
│   └── field-cleanup/           # Salesforce Field Cleanup Agent definition
│       ├── README.md            # Field cleanup agent documentation
│       └── config.yaml          # Agent configuration, LLM parameters, allowed tools
│
├── model_gateway/                # Hot-swappable LLM Model Gateway & Gemini Free support
│   ├── __init__.py              # Package marker
│   ├── gateway.py               # Core router & model fallback handling
│   ├── model_registry.py        # Model catalog & Gemini Free quota limits
│   ├── rate_limiter.py          # Sliding-window RPM, RPD, TPM rate limiter
│   ├── cost_tracker.py          # Token cost tracking (zero cost for Gemini Free)
│   └── gemini_provider.py       # Google Gemini Free API client & offline generator
│
└── tests/                       # Automated test suite
    ├── README.md                # Testing strategy overview
    └── unit/                    # Unit tests (run via Pytest)
        ├── test_policy_engine.py # Tests for PolicyEngine evaluation & rule matching
        ├── test_audit.py        # Tests for HMAC signing & tamper verification
        ├── test_main_app.py     # Tests for FastAPI root and health check endpoints
        └── test_model_gateway.py # Tests for Gemini Free tier routing, costs, and rate limits
```

---

## 2. Detailed Component Responsibilities

### Control Plane Backend (`control_plane/`)
- **What it does**: Acts as the central governance brain. Intercepts every tool call proposed by AI agents, evaluates it against YAML security policies, requires human approval for high-risk actions (Tier 3), and logs every event to an immutable audit ledger.
- **Key Files**:
  - `main.py`: Starts FastAPI on port `8000`.
  - `policy_engine.py`: Core rule evaluation engine.
  - `models.py` & `schemas.py`: Data layer definitions.

### Database Layer (`control-plane/database/`)
- **What it does**: PostgreSQL 17 + `pgvector` database holding registered agents, tool catalog, proposal lifecycle states, HMAC audit entries, and policy rules.
- **Key File**: `init.sql` — Automatically executed when starting PostgreSQL via Docker Compose.

### Policy Layer (`policy/definitions/`)
- **What it does**: Machine-readable security rules in YAML format.
- **Key File**: `sample_field_cleanup_policy.yaml` — Prevents deletion of standard Salesforce fields (`CreatedDate`, `AccountNumber`), prevents deletion of managed package fields, and forces human approval (HITL) for field deletions.

### Test Suite (`tests/unit/`)
- **What it does**: Validates security logic, signature verification, and API startup.
- **Key Files**: `test_policy_engine.py`, `test_audit.py`, `test_main_app.py`.

---

## 3. How to Test the Project Step-by-Step

### Step 1: Prepare Environment
1. Ensure virtual environment is active:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
2. Verify dependencies are installed:
   ```powershell
   pip install -r requirements.txt
   ```

### Step 2: Run Unit Tests (No Database Required)
Run the automated test suite using `pytest`:
```powershell
.\.venv\Scripts\pytest.exe
```
**Expected Output**:
```
collected 11 items
tests\unit\test_audit.py ...                                             [ 27%]
tests\unit\test_main_app.py ..                                           [ 45%]
tests\unit\test_policy_engine.py ......                                  [100%]
============================== 11 passed in 0.78s ==============================
```

### Step 3: Run Policy Engine Standalone Tests
To test policy evaluation rules individually:
```powershell
.\.venv\Scripts\pytest.exe tests/unit/test_policy_engine.py -v
```
**What is tested**:
1. Tier-1 Read Tool -> Auto Allowed (`salesforce_describe_object`).
2. Tier-3 Custom Field Deletion -> Allowed with Human Approval required (`Legacy_Field__c`).
3. Standard Field Deletion -> Rejected by Policy Rule (`AccountNumber`).
4. System Field Deletion -> Rejected by Regex Rule (`CreatedDate`).
5. Managed Package Field Deletion -> Rejected by Namespace Rule (`ns__Field__c`).

### Step 4: Test Local Database & Docker Infrastructure
1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Start PostgreSQL and Redis:
   ```powershell
   docker compose up -d postgres redis
   ```
3. Check container logs and health:
   ```powershell
   docker compose logs postgres
   ```

### Step 5: Test Control Plane API Server
1. Start the API server:
   ```powershell
   .\.venv\Scripts\uvicorn.exe control_plane.main:app --reload --port 8000
   ```
2. Verify API Health Endpoint in terminal or browser:
   ```powershell
   curl http://localhost:8000/health
   ```
   **Response**:
   ```json
   {"status":"ok","environment":"development","version":"0.1.0","policy_rules_loaded":4}
   ```
3. Open Interactive Swagger UI:
   Navigate to `http://localhost:8000/docs` in your browser.

---

## 4. End-to-End Test Workflow via API

Once the API server and database are running, test the complete proposal flow:

1. **Register an Agent**:
   ```powershell
   curl -X POST "http://localhost:8000/api/v1/agents" -H "Content-Type: application/json" -d "{\"agent_id\": \"test-agent-01\", \"name\": \"Field Cleanup Bot\", \"version\": \"1.0.0\"}"
   ```

2. **Submit a Tier-1 Proposal (Read action - Auto-approved)**:
   ```powershell
   curl -X POST "http://localhost:8000/api/v1/proposals" -H "Content-Type: application/json" -d "{\"agent_id\": \"test-agent-01\", \"tool_id\": \"salesforce_describe_object\", \"input_payload\": {\"object_api_name\": \"Account\"}}"
   ```

3. **Submit a Tier-3 Proposal (Destructive action - Needs Human Approval)**:
   ```powershell
   curl -X POST "http://localhost:8000/api/v1/proposals" -H "Content-Type: application/json" -d "{\"agent_id\": \"test-agent-01\", \"tool_id\": \"salesforce_delete_field\", \"input_payload\": {\"field_api_name\": \"Old_Status__c\"}}"
   ```

4. **Get Pending Approvals Queue**:
   ```powershell
   curl "http://localhost:8000/api/v1/proposals/pending"
   ```

5. **Human Decision (Approve Proposal)**:
   ```powershell
   curl -X PUT "http://localhost:8000/api/v1/proposals/<PROPOSAL_ID>/decide" -H "Content-Type: application/json" -d "{\"approved\": true, \"approver_id\": \"lead-dev@company.com\", \"notes\": \"Verified field is unreferenced\"}"
   ```

6. **Check Audit Log Verification**:
   ```powershell
   curl "http://localhost:8000/api/v1/audit"
   ```

---

## 5. Summary Table of Test Commands

| Target | Command | Purpose |
| :--- | :--- | :--- |
| **All Unit Tests** | `pytest` | Runs all 11 unit tests |
| **Policy Engine** | `pytest tests/unit/test_policy_engine.py` | Tests YAML rule evaluation |
| **Audit Logger** | `pytest tests/unit/test_audit.py` | Tests HMAC signatures |
| **Main App** | `pytest tests/unit/test_main_app.py` | Tests FastAPI routes |
| **Docker DB** | `docker compose up -d postgres redis` | Starts database and Redis |
| **API Server** | `uvicorn control_plane.main:app --reload` | Runs FastAPI server on port 8000 |
| **Swagger UI** | Browser: `http://localhost:8000/docs` | Interactive REST API testing |
