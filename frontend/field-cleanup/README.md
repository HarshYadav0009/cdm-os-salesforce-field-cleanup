# CDM-OS — Next.js Governance UI

`frontend/field-cleanup/` is the active dashboard. It uses Next.js App Router, React, TypeScript, Tailwind CSS, and Lucide icons. The dashboard provides Salesforce field assessment, governed cleanup proposals, human review, and audit reporting.

The frontend now targets the endpoint contract supplied on 15 October 2026. The Python backend in this checkout still uses a different contract; it must be updated or replaced with a compatible service before live integration can pass. Frontend contract tests use supplied response fixtures rather than treating the current Python routes as authoritative.

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

Create `frontend/field-cleanup/.env.local` with these local defaults:

```dotenv
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000
NEXT_PUBLIC_TOOL_GATEWAY_URL=http://localhost:8080
```

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONTROL_PLANE_URL` | Browser and server | Control-plane origin; `/api/v1` is appended for API requests |
| `NEXT_PUBLIC_TOOL_GATEWAY_URL` | Next.js server | Gateway proxy fallback |
| `NEXT_PUBLIC_API_BASE` | Browser | Control-plane API URL, including `/api/v1` |
| `CONTROL_PLANE_URL` | Next.js server | Control-plane health check; defaults to the API base or port 8000 |
| `TOOL_GATEWAY_URL` | Next.js server | Gateway proxy and Salesforce health check |
| `MCP_GATEWAY_URL` | Next.js server | Gateway URL fallback when `TOOL_GATEWAY_URL` is absent |
| `NEXT_PUBLIC_WS_URL` | Browser | Optional WebSocket URL for deployments providing a compatible server |

The gateway defaults to `http://127.0.0.1:8080`. The bundled backend has no WebSocket route; leave `NEXT_PUBLIC_WS_URL` unset for this stack. Restart Next.js after changing environment variables.

### 3. Start Next.js

In a separate terminal, from the repository root:

```sh
cd frontend/field-cleanup
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

From `frontend/field-cleanup/`, with backend services running:

```sh
npm run build
npm run start
```

Builds may require network access to fetch the Google fonts configured in `app/layout.tsx`. `NEXT_PUBLIC_*` values are included in the browser build; rebuild after changing them.

All data tables show at most 15 rows per page with Previous/Next controls. Mobile card views use the same page. Filters restart pagination when the matching rows change; audit exports still include all filtered records.

## Dashboard workflows

### Overview and Agents

Overview summarizes agents, recent proposals, approval backlog, and audit activity. Agents registers `{name, type, config}` and sends status changes as a JSON body. Agent IDs are assigned by the API; missing ownership/model metadata is shown as not supplied. These status changes do not directly stop an external worker or enforce an emergency execution stop.

### Dependency Viewer: assess an individual field

1. Select an object and field.
2. Choose **Analyze dependencies** to fetch field usage and reference scans through the Salesforce proxy.
3. Review **Field intelligence** for metadata, field type, permissions, and description.
4. Review **Assessment result** for population, reference counts, scan coverage, findings, and diagnostics. Export the assessment as JSON when needed.
5. Inspect the dependency table and resolve incomplete checks before proposing cleanup.
6. Submit a metadata backup, deprecation, or deletion-review proposal with a reason. Deletion requires explicit confirmation and human approval.

A zero population/reference count is evidence for review, not proof that external integrations do not use the field. Person Account `__pc` fields cannot be directly deprecated or deleted by these tools; review the underlying Contact field separately. Standard fields remain protected, and managed-package fields cannot be deleted.

### Field Tools: bulk scan and recovery

- **Bulk scan:** select objects and a population threshold. Review cleanup candidates, fields with dependencies, active fields, skipped checks, and object errors. Inspect a result in Dependency Viewer or create proposals for selected eligible fields. A bulk batch creates separate proposals per field; eligibility is checked for the selected action.
- **Backup recovery:** choose a backup from the returned completed proposals or enter a backup ID. Supply a reason and confirmation to create a governed description-restoration proposal. Results refresh automatically.
- **Tool catalog:** browse the live gateway capabilities and tiers.

Backups preserve metadata. Recovery restores a description only; it does not restore deleted fields, record data, or field-level security. Deprecation tags the description and leaves field-level security unchanged.

### Approval Queue

Open `/approvals` directly or use the sidebar.

Pending proposals show their target, tool, and tier. Open the evidence dialog to load current metadata, population, and dependency details. These checks are **live evidence**, not a stored snapshot from proposal submission; incomplete checks are shown explicitly.

Enter a decision reason (at least eight characters), then approve or reject. The request sends only `decision` and `reason`; the response contains `DECIDED` and `decided_at`. Decisions do not automatically execute a proposal. Execution is available in Proposals when approval is known from the detail response or from a successful approval submitted in the current browser session. `DECIDED` alone does not imply approval.

### Proposals

Filter by status and browse 15 records per page. Mobile cards and desktop tables open the same detail dialog. Details include policy decisions, human decisions, execution errors/results, and an audit activity timeline. Approved proposals can be dispatched using **Execute approved proposal**.

The list and timeline refresh every ten seconds while the browser tab is visible. Failed proposals are not automatically retried: inspect Salesforce state and the error before creating a new proposal. Previously denied proposals retain their recorded decision.

### Audit Trail and compliance reports

Open `/audit` directly or use the sidebar. Audit supports both the handoff format (`id`, `event_type`, `actor`, `proposal_id`, `payload`, `hmac_signature`, `created_at`) and the compact format (`timestamp`, `action`, `details`). Returned signatures appear as their first 16 characters with a copy control; presence is labelled unverified. Missing signatures remain unavailable. Reports include supplied signatures.

- **Verify proposal:** enter a proposal ID and verification token. The request sends `{proposal_id, verification_token}`. Because the response schema was not specified, the UI displays the returned response and does not assign verification badges to individual events.
- **Download CSV / Print / Save PDF:** export the filtered returned events. These exports do not claim signature verification.

### Policy Manager and Settings

Policy Manager displays the returned array of `{policy_id, rules}`. No enforcement mode or rule tiers are assumed. Settings shows the configured API URL and endpoint information. Unimplemented navigation pages have been removed.

## API reference

Control-plane paths below are relative to `NEXT_PUBLIC_API_BASE`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/agents/` | List/register agents |
| PATCH | `/agents/{agent_id}/status` | Update using `{status}` JSON body |
| GET | `/tools/` | Tool IDs, descriptions, and parameters |
| POST | `/proposals/` | Create and evaluate a proposal |
| GET | `/proposals/` | Summaries; frontend loads detail endpoints and filters locally |
| GET | `/proposals/queue/pending` | Human-review queue |
| GET | `/proposals/{id}` | Proposal status and results |
| PUT | `/proposals/{id}/decide` | Send `{decision, reason}`; receive `{status, decided_at}` |
| POST | `/proposals/{id}/execute` | Receive `{execution_id, result, status}` |
| GET | `/audit/` | Events containing timestamp, action, and details |
| POST | `/audit/verify` | Send `{proposal_id, verification_token}` |
| GET | `/policies/` | Array of policy IDs and rules |

Next.js exposes `/api/control-plane/health`, `/api/salesforce/health`, `/api/salesforce/tools`, and POST `/api/salesforce/{operation}` for describe, field-metadata, field-usage, scan-references, bulk-scan, and allowlisted read-only execution.

## Test and validate

### Frontend checks

From `frontend/field-cleanup/`:

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
6. Inspect supplied audit signatures, download filtered CSV, and print/save a PDF. Use proposal/token verification only with a backend that supports that contract.
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
| Older events/proposals absent | Paginate proposals; audit reports cover the events returned by the API |

From the repository root, inspect services without deleting data:

```sh
docker compose logs --tail 100 control-plane tool-gateway
docker compose restart control-plane tool-gateway
```

Use `docker compose up -d --build` after dependency/image changes. To stop the stack while preserving database volumes, use `docker compose down`; avoid `down -v` unless you intend to delete local database data.

## Important current limits

The local application supports governance workflows but is not a complete production security boundary. Direct gateway mutation endpoints do not yet validate approval tokens, reviewers are not authenticated, agent pause is not enforced at proposal execution, and scoped emergency stops are missing. Precedent storage exists in Python workflows, but UI decisions are not automatically recorded into it. WebSocket broadcasting, complete audit-history exports, and full field/data recovery remain backend work.

## Phase 3 frontend integration

Approval Queue and Audit Log load control-plane decisions and timestamp/action/details records using the supplied endpoint contract. Proposals supports status filtering, execution, results, and errors. Bulk Scan supports selected objects or all objects; select candidates to submit governed deprecation proposals. Dependency Viewer accepts an `Object.Field` shortcut and calls the gateway usage and reference scans through the Next.js proxy. Field mutations continue through control-plane proposals.

Copy `.env.example` to `.env.local` for local API defaults. Backend services and Salesforce connectivity are required for live results. The frontend changes do not implement the backend wiring tasks in the Phase 3 handoff.

### Asynchronous execution responses

Execution accepts either `{execution_id, status: "SUCCESS", result}` or a proposal returned with `EXECUTING`, `COMPLETED`, or `FAILED`. `EXECUTING` is an accepted operation, not a failure. Dependency Viewer polls the existing proposal every two seconds for up to five minutes, without repeating the execution POST. If it is still running, the UI directs users to Proposals. Proposal and recovery views continue refreshing asynchronously. The UI uses the proposal ID when the server does not provide an execution ID, and displays backend failure messages.

### Tool Gateway contract (port 8080)

Browser requests use the Next.js `/api/salesforce/*` proxy. Describe Global sends a POST with no body. Describe sends `{object_name}`; metadata, usage, reference scans, and full assessment send `{object_name, field_name}`. Bulk Scan sends `{object_names, threshold_percentage}`; generic read execution sends `{tool_name, arguments}`. Dependency Viewer includes a full-assessment action that displays the returned object or text.

Gateway responses may be structured JSON or JSON encoded inside a JSON string. Both are decoded. A plain message remains a message; screens requiring structured fields show a clear error rather than inventing scan findings. A successful string health response establishes gateway reachability only; Salesforce connectivity and organization details remain unknown unless explicitly returned.

Backup, deprecation, deletion, and rollback remain governed proposals. Their tool arguments match the gateway DTOs: backup uses object/field names; deprecation adds reason; deletion adds confirmation and reason; rollback sends only backup ID. The frontend strips extra aliases before proposal submission. The control plane dispatches the approved operation to the gateway.

### Reviewer identity compatibility

The approval/rejection dialog requires reviewer email because the repository backend's `HumanDecision` schema requires `reviewer_email`. It sends this alongside decision and reason. The API client accepts both a full proposal decision response (`HUMAN_APPROVED` / `HUMAN_REJECTED`) and the documented compact `DECIDED` response. Validation errors display field names and messages without echoing request values.

### Proposal history pagination

Proposals sends status, limit, and offset to the backend. The HUMAN_REJECTED filter searches rejected proposals across backend history rather than filtering only the default first 50 records. Rows remain visible if fetching supplemental detail fails; opening the detail dialog allows retry. Full proposal rows are used directly without unnecessary per-row requests.

### Phase 3 response compatibility

Audit requests load 50 events by default. Proposal timelines request proposal-specific events (up to 500), filter by proposal ID, and sort chronologically. The mapper preserves event IDs, timestamps, actors, payloads, signatures, and proposal links for the handoff format while continuing to accept compact events. A signature is never labelled verified solely because it is present.

Bulk Scan accepts either the gateway's existing flat arrays or the document's `{scan_summary, objects: [{object_name, fields}]}` format, including JSON-encoded responses. Nested classifications map to the existing cleanup/review/active filters. The UI does not invent missing record counts, reference counts, field types, or scan timestamps. Selecting a candidate and submitting deprecation uses the same object and field names from either format.

## Live frontend verification

See [FRONTEND_VERIFICATION.md](./FRONTEND_VERIFICATION.md) for the completed read-only browser checks, observed bulk-scan results, fixes, and remaining live-write verification limits.
