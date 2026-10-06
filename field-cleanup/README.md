# CDM-OS Guardian & Governance Dashboard

The frontend is the human oversight layer for the CDM-OS control plane. It is built with Next.js App Router, React, TypeScript, Tailwind CSS, and Lucide icons.

## Dashboard areas

- **Overview** — agent health, approval backlog, cost and drift signals, recent audit activity, and realtime connection status.
- **Agents** — agent status, tier, guardian, model configuration, recent activity, and pause/resume requests.
- **Approval Queue** — proposal context, risk evidence, and approve/reject decisions with a required reason.
- **Audit Trail** — searchable and filterable event history with export requests.
- **Policy Manager** — YAML policy editing with basic client validation and pull-request submission.
- **Digital Boardroom** — conflict review and auditable arbitration decisions.
- **Cost Dashboard** — cost summaries, agent-level spend, and daily trends.
- **Kill Switches** — agent, pod, capability, and global stops with a typed confirmation phrase and required reason.
- **Drift Monitor** — model, prompt, and knowledge baseline comparisons.

## Control-plane integration

The API base defaults to `http://localhost:8000/api/v1`; set `NEXT_PUBLIC_API_BASE` to override it. The pulled FastAPI control plane currently registers only the following routes:

| Method | Path                                          | Purpose                                                                                             |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/proposals/`                                 | Submit an agent tool-call proposal; policy evaluation determines its status                         |
| GET    | `/proposals/`                                 | List proposals (supports `status`, `agent_id`, `limit`, and `offset`)                              |
| GET    | `/proposals/queue/pending`                    | Proposals waiting for human approval                                                                |
| GET    | `/proposals/{proposal_id}`                    | Fetch one proposal                                                                                  |
| PUT    | `/proposals/{id}/decide`                      | Decide a pending proposal (`decision: APPROVED\|REJECTED`, `reviewer_email`, `reason`)              |
| POST   | `/proposals/{id}/execute`                     | Execute a `HUMAN_APPROVED` or `POLICY_APPROVED` proposal                                            |
| GET    | `/agents/`                                    | List registered agents                                                                             |
| POST   | `/agents/`                                    | Register an agent                                                                                   |
| GET    | `/agents/{agent_id}`                          | Fetch one agent                                                                                     |
| PATCH  | `/agents/{agent_id}/status?status=PAUSED`     | Change an agent status (`IDLE`, `RUNNING`, `PAUSED`, `ERROR`, or `TERMINATED`)                     |
| GET    | `/tools/`                                     | List registered tools and tiers                                                                     |
| GET    | `/audit/?limit=50`                            | Read recent audit events; accepts `event_type`, `proposal_id`, and `limit` filters                  |

The Overview, Agents, Approval Queue, and Audit Trail pages use the supported endpoints above. Proposal creation is performed by an agent or API client via `POST /proposals/`; the Approval Queue only lists and decides pending proposals.

The backend does not currently register endpoints for dashboard summary, policy CRUD, digital boardroom, costs, kill-switch scopes, drift, audit export, or WebSockets. Their UI pages identify these gaps and do not send requests to nonexistent routes. The backend policy engine loads YAML policy files at startup; there is no policy-management API yet.

`NEXT_PUBLIC_WS_URL` may be configured for a separate deployment that provides a WebSocket server. The pulled FastAPI backend itself does not expose a WebSocket route.

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run lint
npm run build
```
