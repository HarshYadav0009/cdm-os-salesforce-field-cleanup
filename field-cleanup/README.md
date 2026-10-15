# CDM-OS — Next.js Governance UI

`field-cleanup/` is the active dashboard, replacing the Vite UI planned under `frontend/`. It uses Next.js App Router, React, TypeScript, Tailwind CSS, and Lucide icons. The dashboard provides Salesforce field assessment, governed cleanup proposals, human review, and audit reporting.

## How the application works

```text
Next.js UI (localhost:3000)
  ├─ Browser → Control Plane REST API (localhost:8000/api/v1)
  │    └─ Policy evaluation → proposal → approval → background execution
  │         └─ Tool Gateway (localhost:8080) → Salesforce MCP subprocess → Salesforce
  └─ Next.js /api/salesforce/* → Tool Gateway → read-only Salesforce checks

Control Plane → PostgreSQL: agents, tools, proposals, decisions, audit events
Docker Compose → PostgreSQL + Redis + Control Plane + Tool Gateway
```

The browser creates proposals through the control plane for field changes. The Next.js Salesforce proxy permits read-only checks and blocks mutating tools on its generic execution route. Approval and execution are separate stages: dispatching an operation does not mean it has completed.

The UI is responsive: navigation adapts to mobile, proposals and approvals use mobile cards, controls stack on narrow screens, and dialogs and tables scroll when needed. Dark/light theme selection is saved locally.

## Prerequisites

- Node.js 20.9 or later and npm.
- Docker with Docker Compose for the recommended local backend setup.
- A Salesforce sandbox for live checks, or `SF_MOCK_MODE=true` in the root `.env` for mock data.
- Python 3.11 or later if running backend services/tests outside Docker. Docker uses Python 3.12.

## Run locally

### 1. Configure and start backend services

From the **repository root**, create the environment file if it does not already exist:

```sh
cp .env.example .env
```

Preserve an existing `.env`; do not overwrite working credentials. Configure Salesforce values (`SF_USERNAME`, `SF_PASSWORD`, `SF_SECURITY_TOKEN`, and `SF_DOMAIN=test`) for your sandbox, or use mock mode. Keep secrets in the root environment file, never in `NEXT_PUBLIC_*` variables. Keep `POLICY_MODE=enforce` for the normal approval workflow and configure `AUDIT_HMAC_SECRET` before generating audit events.

```sh
docker compose up -d --build
docker compose ps
```

Compose starts PostgreSQL on 5432, Redis on 6379, the control plane on 8000, and the gateway on 8080. It does **not** start the Next.js UI. Control-plane startup creates database tables and seeds the default `field-cleanup-agent` and supported tool definitions.

### 2. Configure the UI

Create `field-cleanup/.env.local` with these local defaults:

```dotenv
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
CONTROL_PLANE_URL=http://127.0.0.1:8000
TOOL_GATEWAY_URL=http://127.0.0.1:8080
```

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | Browser | Control-plane API URL, including `/api/v1` |
| `CONTROL_PLANE_URL` | Next.js server | Control-plane health check; defaults to the API base or port 8000 |
| `TOOL_GATEWAY_URL` | Next.js server | Gateway proxy and Salesforce health check |
| `MCP_GATEWAY_URL` | Next.js server | Gateway URL fallback when `TOOL_GATEWAY_URL` is absent |
| `NEXT_PUBLIC_WS_URL` | Browser | Optional WebSocket URL for deployments providing a compatible server |

The gateway defaults to `http://127.0.0.1:8080`. The bundled backend has no WebSocket route; leave `NEXT_PUBLIC_WS_URL` unset for this stack. Restart Next.js after changing environment variables.

### 3. Start Next.js

In a separate terminal, from the repository root:

```sh
cd field-cleanup
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend allows browser requests from `http://localhost:3000`. If Next.js selects another port, or you access it using a LAN address, the backend CORS configuration and browser API URL must also support that address. Server-side gateway URLs must be reachable from the machine running Next.js.

### 4. Check connectivity

```sh
curl http://localhost:8000/health
curl http://localhost:8080/health
curl http://localhost:3000/api/control-plane/health
curl http://localhost:3000/api/salesforce/health
```

The Salesforce status reports whether the connection uses mock data. A successful mock health check does not validate live sandbox credentials.

### Production-mode UI

From `field-cleanup/`, with backend services running:

```sh
npm run build
npm run start
```

Builds may require network access to fetch the Google fonts configured in `app/layout.tsx`. `NEXT_PUBLIC_*` values are included in the browser build; rebuild after changing them.

## Dashboard workflows

### Overview and Agents

Overview summarizes agents, recent proposals, approval backlog, and audit activity. Agents supports registration and recorded status changes, including PAUSED and TERMINATED. These status changes do not directly stop an external worker or enforce an emergency execution stop.

### Dependency Viewer: assess an individual field

1. Select an object and field.
2. Choose **Analyze dependencies** to create and execute a governed read-only assessment.
3. Review **Field intelligence** for metadata, field type, permissions, and description.
4. Review **Assessment result** for population, reference counts, scan coverage, findings, and diagnostics. Export the assessment as JSON when needed.
5. Inspect the dependency table and resolve incomplete checks before proposing cleanup.
6. Submit a metadata backup, deprecation, or deletion-review proposal with a reason. Deletion requires explicit confirmation and human approval.

A zero population/reference count is evidence for review, not proof that external integrations do not use the field. Person Account `__pc` fields cannot be directly deprecated or deleted by these tools; review the underlying Contact field separately. Standard fields remain protected, and managed-package fields cannot be deleted.

### Field Tools: bulk scan and recovery

- **Bulk scan:** select objects and a population threshold. Review cleanup candidates, fields with dependencies, active fields, skipped checks, and object errors. Inspect a result in Dependency Viewer or create proposals for selected eligible fields. A bulk batch creates separate proposals per field; eligibility is checked for the selected action.
- **Backup recovery:** choose a backup from the latest 100 completed proposals or enter a backup ID. Supply a reason and confirmation to create a governed description-restoration proposal. Results refresh automatically.
- **Tool catalog:** browse the live gateway capabilities and tiers.

Backups preserve metadata. Recovery restores a description only; it does not restore deleted fields, record data, or field-level security. Deprecation tags the description and leaves field-level security unchanged.

### Approval Queue

Pending proposals show their target, tool, and tier. Open the evidence dialog to load current metadata, population, and dependency details. These checks are **live evidence**, not a stored snapshot from proposal submission; incomplete checks are shown explicitly.

Enter a reviewer email and an audited reason (at least eight characters), then approve or reject. Approval dispatches execution; rejection does not execute or roll back a change. The latest approved execution panel refreshes every three seconds and displays failures or results. Reviewer email is currently self-reported, not an authenticated identity.

### Proposals

Filter by status and browse 20 records per page. Mobile cards and desktop tables open the same detail dialog. Details include policy decisions, human decisions, execution errors/results, and an audit activity timeline. Approved proposals can be dispatched using **Execute approved proposal**.

The list and timeline refresh every ten seconds while the browser tab is visible. Failed proposals are not automatically retried: inspect Salesforce state and the error before creating a new proposal. Previously denied proposals retain their recorded decision.

### Audit Trail and compliance reports

Search/filter the latest 500 audit records by date, actor, action, and content. Open an event to inspect its payload and signature.

- **Verify signatures:** asks the control plane to verify the filtered records without exposing the HMAC secret. Results distinguish Verified, Invalid, Missing, and Not found.
- **Download CSV:** downloads the filtered events, proposal IDs, payloads, and verification statuses.
- **Print / Save PDF:** opens a printable report. Choose **Print / Save as PDF** in that report and select your browser's PDF destination. Allow popups if the report is blocked.

Verification covers the **event payload only**, not the complete record, log ordering, or append-only storage guarantees. A signature being present does not mean it was verified. Reports cover the filtered subset of the latest 500 events, not the entire database history. Audit data refreshes every ten seconds while the tab is visible.

### Policy Manager, Settings, and unavailable areas

Policy Manager displays the active mode and loaded YAML rules; it does not edit policies. Settings shows connectivity and current capabilities. Digital Boardroom, Cost Dashboard, scoped Kill Switches, and Drift Monitor identify unavailable backend features rather than presenting fabricated live data.

## API reference

Control-plane paths below are relative to `NEXT_PUBLIC_API_BASE`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/agents/` | List/register agents |
| GET | `/agents/{agent_id}` | Agent details |
| PATCH | `/agents/{agent_id}/status?status=PAUSED` | Recorded agent status |
| GET | `/tools/` | Registered tools and tiers |
| POST | `/proposals/` | Create and evaluate a proposal |
| GET | `/proposals/?status=COMPLETED&limit=20&offset=0` | Paginated/filterable proposals |
| GET | `/proposals/queue/pending` | Human-review queue |
| GET | `/proposals/{id}` | Proposal status and results |
| PUT | `/proposals/{id}/decide` | Human decision |
| POST | `/proposals/{id}/execute` | Dispatch an approved proposal |
| GET | `/audit/?limit=500` | Recent events; also accepts `event_type` and `proposal_id` |
| POST | `/audit/verify` | Verify payload signatures; body: `{ "ids": ["<audit-event-uuid>"] }` |
| GET | `/policies/` | Loaded policy rules and mode |

Next.js exposes `/api/control-plane/health`, `/api/salesforce/health`, `/api/salesforce/tools`, and POST `/api/salesforce/{operation}` for describe, field-metadata, field-usage, scan-references, bulk-scan, and allowlisted read-only execution.

## Test and validate

### Frontend checks

From `field-cleanup/`:

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

`npm test` runs Node tests under `tests/*.test.mjs`. They cover gateway proxy forwarding, mutation blocking, errors, health checks, CSV escaping/formula protection, and print-report HTML escaping. They do not require live Salesforce and do not replace browser interaction tests.

### Backend checks

From the **repository root**, use a Python virtual environment:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r tool-gateway/requirements.txt
python -m pytest tests/unit/test_audit.py tests/unit/test_main_app.py -q
python -m pytest tests/unit -q
```

On Windows, activate with `.venv\Scripts\Activate.ps1` in PowerShell. Root requirements include `pytest-asyncio`; install them into the interpreter running tests so asynchronous tests can execute.

At the last full review, the backend suite had failures in duplicate-proposal tests omitting required deletion confirmation, a user-name lookup fixture, and async tests when `pytest-asyncio` was missing. These are separate from the frontend checks; rerun the suite to assess your current checkout. The latest targeted audit/API checks and frontend checks passed.

### Manual responsive acceptance checks

Use browser responsive mode at approximately 375px, 768px, and 1440px:

1. Open/close mobile navigation and switch themes.
2. Inspect a field; confirm metadata and assessment metrics are not duplicated.
3. Test loading, empty, partial-scan, and connection-error states.
4. Filter and paginate proposals; open details and inspect the activity timeline.
5. Open approval evidence and navigate the dialog by keyboard, including Tab and Escape.
6. Verify audit signatures, download filtered CSV, and print/save a PDF.
7. On a disposable sandbox field only, test the full proposal → approval → execution → audit flow. Confirm failures remain visible and standard/managed/Person Account protections apply.

No browser automation is currently included. Live mutation tests can change Salesforce; use a disposable sandbox and review the field before confirming.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| UI loads but API calls fail | Control plane is running; API base includes `/api/v1`; browser origin is allowed by CORS |
| Next.js starts on 3001 | Free port 3000 or update backend CORS for the chosen origin |
| Salesforce shows offline | Check gateway `/health`, root Salesforce configuration, and gateway logs |
| Mock data shown instead of sandbox | Check `SF_MOCK_MODE` and credentials; client can fall back to mock mode after authentication failure |
| MCP reports `No module named servers` | Use the current gateway code and configured MCP subprocess working directory; inspect Docker logs |
| Proposal approved but not completed | Inspect Proposals status, execution error, and audit timeline; dispatch is asynchronous |
| `__pc` metadata operation fails | Review the underlying Contact custom field; do not mutate the Account representation |
| Verification returns 404 | Update/restart the control plane so `/api/v1/audit/verify` is registered |
| Invalid audit signature | Review the record and signing-secret configuration; changing the secret invalidates existing signatures |
| No realtime connection | Expected with the bundled backend; supported screens use polling |
| PDF report does not open | Allow popups, then use the report's Print / Save as PDF button |
| Older events/proposals absent | Paginate proposals; audit reports currently cover the latest 500 events |

From the repository root, inspect services without deleting data:

```sh
docker compose logs --tail 100 control-plane tool-gateway
docker compose restart control-plane tool-gateway
```

Use `docker compose up -d --build` after dependency/image changes. To stop the stack while preserving database volumes, use `docker compose down`; avoid `down -v` unless you intend to delete local database data.

## Important current limits

The local application supports governance workflows but is not a complete production security boundary. Direct gateway mutation endpoints do not yet validate approval tokens, reviewers are not authenticated, agent pause is not enforced at proposal execution, and scoped emergency stops are missing. Precedent storage exists in Python workflows, but UI decisions are not automatically recorded into it. WebSocket broadcasting, complete audit-history exports, and full field/data recovery remain backend work.
