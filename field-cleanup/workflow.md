# Salesforce Field Cleanup — Actual Workflow and UI/Data-Flow Report

## Scope and method

This report analyzes the fetched repository **outside this `field-cleanup/` directory**. The report is stored here because it was requested in the Next.js folder; its workflow findings and proposed UI are based on the rest of the repository, not on the existing Next.js implementation.

The repository contains architecture documents and YAML templates as well as executable Python services. They do not all describe the same workflow. To distinguish expected behavior from actual behavior, this report labels code that runs as **implemented**, documents/configuration as **declared**, and missing integration as **not wired**.

## Executive summary

The fetched repository implements useful pieces of Salesforce field cleanup:

- Salesforce metadata, population, and reference scanning tools in the Tool Gateway.
- An agent-runtime analyzer that combines metadata, usage, and optional reference scans.
- A second analysis workflow that gathers metadata, usage, Apex/Flow/LWC reference results, precedents, and builds a structured cleanup proposal.
- A proposal builder and a separate service capable of submitting proposals to the Control Plane.
- Control Plane proposal creation, policy evaluation, human decisions, audit events, and an execution-dispatch API.
- A Tool Gateway HTTP API exposing read, backup, deprecation, rollback, and bulk-scan operations.

However, these pieces are **not joined into one functioning end-to-end workflow**. In particular:

1. No durable workflow engine, workflow-run API, workflow state store, or runner is present in the fetched files. Workflow-engine READMEs describe files that are not present.
2. The analyzer and proposal-building workflow do not submit their results to the Control Plane. A proposal submission service exists separately, but no caller wires it to either analysis path.
3. Control Plane proposal execution currently maps only object description, field-usage query, and health-check tool IDs. It does not dispatch field deprecation, field deletion, backup, rollback, or verification.
4. The repository's field-deletion YAML/config describes `salesforce_delete_field`, but the actual Salesforce gateway does not expose that tool. Its destructive-looking implemented operation is field **deprecation**, not deletion.
5. There is no implemented post-change verification stage, approval timeout/escalation state machine, workflow retries/checkpointing, or workflow-level audit transitions.

Therefore, a frontend can truthfully display registered proposals, make approval decisions, and show audit events using existing Control Plane APIs. A UI for starting a scan and displaying durable workflow progress requires backend orchestration/run APIs and persistence that are not present in this fetched repository.

## Repository components and their roles

| Component | Implemented responsibility | Evidence |
|---|---|---|
| Agent configuration | Declares model settings, allowed Salesforce tools/tiers, and instructions to inspect references and submit proposals rather than delete directly. | [`agents/field-cleanup/config.yaml`](../agents/field-cleanup/config.yaml) |
| Agent runtime analyzer | Calls the Tool Gateway to describe an object, query field population, verify the field exists, optionally scan references, and return analysis plus `safe_for_cleanup`. | [`agent-runtime/analysis/field_analyzer.py`](../agent-runtime/analysis/field_analyzer.py) |
| Salesforce Tool Gateway | Exposes MCP operations for metadata, usage, reference scans, backups, deprecation, rollback, and bulk scans. | [`tool-gateway/servers/salesforce/server.py`](../tool-gateway/servers/salesforce/server.py), [`tool-gateway/servers/salesforce/mcp_client.py`](../tool-gateway/servers/salesforce/mcp_client.py) |
| HTTP Tool Gateway | Exposes REST endpoints on the gateway service for the same operations, including `/tools/salesforce/bulk-scan` and `/tools/execute`. | [`tool-gateway/gateway/api.py`](../tool-gateway/gateway/api.py), [`tool-gateway/gateway/service.py`](../tool-gateway/gateway/service.py) |
| Analysis workflow | Calls describe, usage, reference scan, and precedent lookup, then passes evidence to a proposal builder. There are two similarly named workflow implementations. | [`tool-gateway/workflows/field_cleanup.py`](../tool-gateway/workflows/field_cleanup.py), [`tool-gateway/servers/workflows/field_cleanup.py`](../tool-gateway/servers/workflows/field_cleanup.py) |
| Proposal builder | Converts evidence into a structured `FIELD_CLEANUP` proposal with field metadata, usage/reference/precedent evidence, risk, recommended action, and approval fields. | [`tool-gateway/proposals/field_cleanup.py`](../tool-gateway/proposals/field_cleanup.py) |
| Proposal submission client | Posts `{agent_id, tool_id, input_payload}` to Control Plane `POST /api/v1/proposals/`. It is a utility, not currently called by the analysis workflow. | [`tool-gateway/proposals/proposal_service.py`](../tool-gateway/proposals/proposal_service.py) |
| Control Plane | Registers agents/tools, evaluates proposal policy, stores proposal status, accepts human decisions, dispatches a limited set of executions, and serves audit/proposal APIs. | [`control_plane/main.py`](../control_plane/main.py), [`control_plane/routes/proposals.py`](../control_plane/routes/proposals.py) |
| Policy engine | Loads YAML policy rules; Tier-1 proposals are implicitly allowed, Tier-3 proposals require human approval, and matching rules may deny or require human approval. | [`control_plane/policy_engine.py`](../control_plane/policy_engine.py) |
| Audit | Records HMAC-SHA256-signed events in the audit database and provides a read API. | [`control_plane/audit.py`](../control_plane/audit.py), [`control_plane/routes/audit.py`](../control_plane/routes/audit.py) |
| Deployment | Compose starts Postgres, Redis, Control Plane on port 8000, and HTTP Tool Gateway on port 8080. It does not start an agent runtime or workflow engine. | [`docker-compose.yml`](../docker-compose.yml) |

## Actual data flow in the code

### A. Scan and analyze

There are two analysis paths:

1. **Agent runtime path:** `FieldAnalyzer.analyze_field(object_name, field_name)` requests metadata, usage metrics, and—by default—references through `ToolGatewayClient`. It verifies the field appears in metadata and returns the evidence and `safe_for_cleanup`.
2. **Tool-Gateway workflow path:** `FieldCleanupWorkflow.analyze(object_name, field_name)` invokes the Salesforce MCP client for object metadata, field usage, Apex/Flow/LWC references, and precedent applicability. It then calls `FieldCleanupProposalBuilder.build(...)` and returns the built proposal object.

The Salesforce usage service measures populated records, total records, and population percentage. It does not establish last-use date or historical usage over 90/180 days; its SOQL checks whether the field is populated. Reference scanning checks Apex classes, triggers, Flows, and LWCs for the field API name. The bulk scanner classifies fields as cleanup candidates, needing review due to references, or active.

The proposal builder includes evidence such as total/populated records, usage percentage, zero-usage candidate, reference count/summary, precedent warning, risk, action, and approval status.

**Important limitation:** the agent-runtime analyzer catches reference-scan exceptions and sets references to `None`; its `safe_for_cleanup` expression treats `None` as acceptable (`references is None or no references`). This means a failed optional reference scan can still yield `safe_for_cleanup: true` when the other checks pass. The separate workflow path does not show this same catch-and-continue behavior.

### B. Proposal submission and policy

`ProposalService.submit_proposal(...)` can send the analysis result to Control Plane `POST /api/v1/proposals/`. The Control Plane expects an envelope with:

```json
{
  "agent_id": "registered-agent-id",
  "tool_id": "registered-tool-id",
  "input_payload": { "analysis": "or tool-specific arguments" }
}
```

On receipt, the Control Plane:

1. Confirms the agent and tool are registered.
2. Evaluates `tool_id`, the registered tool tier, and `input_payload` with the policy engine.
3. Chooses `POLICY_DENIED`, `PENDING_HUMAN_APPROVAL`, or `POLICY_APPROVED`.
4. Stores the proposal and records `PROPOSAL_CREATED` and `POLICY_CHECK` audit events.

The analysis workflows do not call `ProposalService` in the fetched code, so the analysis-to-proposal handoff is **not wired**. The Control Plane can accept proposals from another client, but there is no route here to start field analysis and automatically submit its result.

### C. Approval

For a proposal in `PENDING_HUMAN_APPROVAL`, the Control Plane's `PUT /api/v1/proposals/{id}/decide` accepts `APPROVED` or `REJECTED`, reviewer email, and reason. It stores the decision and changes status to `HUMAN_APPROVED` or `HUMAN_REJECTED`, recording a `HUMAN_DECISION` audit event.

The decision endpoint rejects a decision for any proposal not currently pending. This is a proposal-level gate; the repository does not implement the sample YAML's Jira ticket, Slack notification, role quorum, 48-hour timer, or waiting state runner.

### D. Execution, audit, and completion

`POST /api/v1/proposals/{id}/execute` accepts only `HUMAN_APPROVED` or `POLICY_APPROVED` proposals. It changes status to `EXECUTING`, records `EXECUTION_STARTED`, and schedules a background task.

The current execution dispatcher maps only:

- `salesforce_describe_object` → `/tools/salesforce/describe`
- `salesforce_query_field_usage` → `/tools/salesforce/field-usage`
- `salesforce_health_check` → `/health`

On success it records `TOOL_EXECUTED` and sets `COMPLETED`; on a missing mapping or failed request it records `EXECUTION_FAILED` and sets `FAILED`.

This dispatcher does **not** currently run `salesforce_deprecate_field`, `salesforce_delete_field`, backup, rollback, or a verification operation. Consequently, an approved cleanup action is not presently executed end-to-end through the Control Plane, even though direct Tool Gateway endpoints for deprecation/backup/rollback exist.

Audit entries are HMAC-signed over each event payload and returned by `GET /api/v1/audit/`. They can include proposal creation, policy evaluation, human decision, execution start, execution success, and execution failure. They do not currently represent all the named YAML workflow states because those states are not orchestrated.

## Declarative workflow files versus actual execution

The repository has two distinct workflow descriptions:

- [`workflows/sample_deletion_approval_workflow.yaml`](../workflows/sample_deletion_approval_workflow.yaml) describes a Tier-3 delete approval flow with Jira ticket creation, Slack notification, role-based approval, a 48-hour timeout, conditional execution, and rejection audit.
- [`workflows/README.md`](../workflows/README.md) contains an example field-cleanup state machine with scan → analyze → propose → Guardian approval → execute → verify → audit, plus timeout escalation and retry settings.

The docs refer to a Workflow Engine in `control-plane/workflow/`, and [`control-plane/workflow/README.md`](../control-plane/workflow/README.md) describes durable state, checkpoint/resume, retries, and approval gates. In the fetched file listing, that folder contains only the README: no engine, schema, retry manager, state store, orchestrator, runner, or workflow API implementation is present. The YAML is therefore **declared, not executed** by the current code.

## Material implementation gaps and inconsistencies

These affect what a UI can honestly display and what backend work is needed:

1. **No workflow run contract:** no create/list/get/cancel workflow-run endpoints, persisted run ID, current state, step output, retry count, or transition history.
2. **Analysis is not started from Control Plane:** analysis classes are callable Python components, but there is no API endpoint/worker connecting a UI start action to an analyzer.
3. **Proposal submission is disconnected:** `ProposalService` exists, but neither `FieldAnalyzer` nor `FieldCleanupWorkflow` invokes it.
4. **Deletion is only declared, not implemented as a gateway tool:** the agent config and sample policy refer to `salesforce_delete_field`; the Salesforce MCP server and Tool Gateway list `salesforce_deprecate_field`, not a delete tool. The gateway offers deprecation with backup, description tagging, FLS restriction, and rollback-on-error.
5. **Control Plane execution mapping is narrower than registered/tool-gateway tools:** it does not dispatch the deprecation endpoint (or deletion), despite an HTTP endpoint existing for deprecation.
6. **Tool identity/tier differences:** Control Plane startup seeds `salesforce_query_field_usage` as Tier-2, while the Tool Gateway advertises it as Tier-1 and agent config declares it Tier-1. Seeded tools also include `salesforce_full_field_assessment`, which is not in the HTTP gateway's advertised tool list. The UI should use the tier on the proposal/tool response from the API rather than assume a static local mapping, but the source-of-truth conflict should be resolved.
7. **Policy YAML and evaluator differ:** the policy includes `time_window` and `always` conditions, but the evaluator shown does not enforce those condition forms; it does implement `deny_if`, rate limits, and HITL rules. It may therefore not enforce every safeguard a policy reader might infer from the YAML.
8. **Runtime Tool Gateway URL defaults differ:** `agent-runtime/tools/tool_gateway_client.py` defaults to port 8001, while Compose and the Control Plane configuration use port 8080. A deployment must provide a matching environment setting or align these values.
9. **Control Plane gateway address is not Compose-safe:** the execution task builds its URL using `127.0.0.1:{MCP_GATEWAY_PORT}`. In the Compose setup, the Control Plane and Tool Gateway are separate containers, so `127.0.0.1` inside the Control Plane container points back to the Control Plane container, not the gateway. The service DNS name (for example, `tool-gateway`) or a configurable gateway host is needed for container-to-container execution.
10. **Tests/documented flows are not a full end-to-end proof:** for example, the integration script submits a proposal-builder result directly where the API expects the agent/tool/input envelope, and its Tier-3 test verifies proposal decision and audit but does not execute a cleanup. The advertised full-assessment HTTP route in `test_all_endpoints.py` is not listed in `tool-gateway/gateway/api.py`.
11. **Verification absent:** no code confirms a field change did not break Salesforce dependencies after remediation. Reference scanning is pre-change analysis, not post-change verification.
12. **Timeout/escalation absent:** proposal approval has no timer, expiration handling, or Skill Lead escalation. The sample YAML and README examples describe differing approval requirements/timeouts.

## UI to build, based on the available backend contract

Separate UI for **currently supported proposal management** from UI for **future workflow orchestration**. Do not label a UI state as live workflow progress until the run API exists.

### UI 1 — Proposal inbox (can be built against existing API)

**Purpose:** review proposals that the policy engine marked pending.

**Data:** `GET /api/v1/proposals/queue/pending`, returning proposal IDs, agent/tool IDs, tier, status, input payload, policy result, and created timestamp.

**Components:**

- Queue table/cards: proposal, target object/field (extracted from payload), tool/action, tier/risk, submitted time, and status.
- Tier badge driven by API `tier`; display policy result and risk evidence from the actual payload, not fabricated fallback values.
- Evidence/detail panel: full input payload, usage counts/percentage, zero-usage flag, reference findings, recommended action, policy matched rules and denial reasons. Missing evidence should be visibly “not provided” / “scan failed,” never presented as a clean scan.
- Decision modal: reviewer email, decision reason, approve/reject selection, validation, busy state, and API errors.
- On successful decision, refresh the proposal list. Approval should call `PUT .../decide`; execution should be a separate explicit operation or be clearly described as an automatic next action if the product/backend contract keeps that behavior.

**Data flow:**

```text
Control Plane GET pending proposals
  → UI maps proposal/input_payload/policy_result to rows and detail view
  → reviewer submits email + reason + decision
  → Control Plane PUT /proposals/{id}/decide
  → database updates human_decision/status; HUMAN_DECISION audit row is written
  → UI refreshes proposal and audit data
```

### UI 2 — Proposal history/details (can be built against existing API)

**Purpose:** inspect submitted and completed/failed proposals, not only pending approvals.

**Data:** `GET /api/v1/proposals/` with optional `status`, `agent_id`, `limit`, and `offset`; `GET /api/v1/proposals/{id}` for detail.

**Components:** filters, status timeline based only on actual proposal status/timestamps, execution result/error panel, decision actor/reason, and links to related audit entries. Keep `POLICY_APPROVED`, `HUMAN_APPROVED`, `EXECUTING`, `COMPLETED`, `FAILED`, and rejection/denial states distinct.

### UI 3 — Audit integrity log (can be built against existing API)

**Purpose:** inspect recorded proposal, policy, decision, and execution events.

**Data:** `GET /api/v1/audit/?limit=...`, optionally filterable by `event_type` and `proposal_id`.

**Components:** newest-first timeline/table; event type, timestamp, actor, proposal ID, payload details; HMAC presence and truncated signature; copy-signature action only if clipboard support and error feedback are implemented. Avoid describing a signature badge as cryptographic verification unless the UI calls a verification API—the current audit route returns entries but exposes no verify endpoint.

**Data flow:**

```text
Control Plane proposal/decision/execution actions
  → record_event() HMAC-signs payload and stores audit entry
  → UI GET /api/v1/audit/
  → UI renders event details and signature presence
```

### UI 4 — Workflow launch and run monitor (requires backend first)

This would represent the intended scan → analyze → propose → approval → execute → verify → audit lifecycle. Before implementing “Start scan” as a real operation, add a backend contract for:

- Starting a run with Salesforce object(s), optional field selection/usage threshold, environment/org identifier, and requesting agent/actor.
- Returning a durable `workflow_run_id`.
- Listing/fetching a run with current state, timestamps, stage status, inputs/outputs, errors, attempts, and related proposal IDs.
- Persisting every transition and supporting refresh/resume after page reload.
- Explicit pause/cancel and retry semantics, if intended.
- Approval wait/deadline and escalation destination/status.
- A verifiable post-execution result for the verification step.

**Suggested UI components once that contract exists:**

1. **Run creation form:** object/field scope, scan threshold, target environment, preview of read/write actions, and explicit submit.
2. **Run list:** ID, started by/at, environment, current stage, status, candidates count, pending approvals, and failure indicator.
3. **Run detail stepper:** SCAN, ANALYZE, PROPOSE, APPROVE, EXECUTE, VERIFY, AUDIT with real persisted timestamps/state and expandable outputs.
4. **Findings table:** object, field, custom/standard classification, populated/total count, usage %, references and source, precedent warning, recommended action, and safety decision.
5. **Proposal review link:** connect each finding/proposal to the proposal inbox and approval decision.
6. **Approval wait/escalation panel:** approver, due time, remaining time, decision, timeout status, and escalation state—only when returned by backend.
7. **Execution and verification panel:** backup ID, performed action, result, rollback state if any, and post-change verification results.
8. **Run audit timeline:** all transitions associated with `workflow_run_id` and proposal IDs.

**Future workflow data flow:**

```text
UI start-run request
  → Workflow API validates request and persists run
  → Workflow engine schedules SCAN via Agent Runtime / Tool Gateway
  → Salesforce metadata + usage + reference evidence
  → ANALYZE classifies findings and records evidence
  → PROPOSE builder creates proposal; proposal service submits it to Control Plane
  → Control Plane policy decides denied / auto-approved / pending human approval
  → APPROVE UI posts decision; engine resumes from durable state
  → EXECUTE invokes an allowlisted, policy-approved Tool Gateway operation
  → VERIFY checks actual post-change Salesforce state/dependencies
  → AUDIT persists each transition and links HMAC-signed events
  → UI reads workflow-run, proposal, and audit APIs
```

This future flow is a UI/backend design recommendation based on repository components; it is **not** the current connected execution path.

## Recommended implementation order

1. Agree on the authoritative tool catalog and tiers; align agent config, database seeds, policy, gateway catalog, and execution mappings.
2. Decide whether the supported remediation is deprecation or permanent deletion. Do not expose “delete” if only deprecation is actually implemented.
3. Wire analyzer → proposal builder → proposal submission, with typed payload/schema contracts and explicit handling of failed reference scans.
4. Extend Control Plane execution through an allowlisted gateway operation; persist execution outputs and failures, and add a real verification operation before marking a workflow complete.
5. Implement durable workflow runs/state transitions, retries, timeout/escalation, and audit linkage; provide APIs for create/list/get/resume/cancel.
6. Build proposal inbox/history/audit UI against existing APIs; then add workflow launch/monitor UI against the newly agreed workflow API.
7. Add integration tests that run the same contract end to end: scan → proposal submitted → policy → pending approval → decision → actual authorized action → verification → audit.

## Key source files (outside `field-cleanup/`)

- [`agents/field-cleanup/config.yaml`](../agents/field-cleanup/config.yaml)
- [`agent-runtime/analysis/field_analyzer.py`](../agent-runtime/analysis/field_analyzer.py)
- [`agent-runtime/tools/tool_gateway_client.py`](../agent-runtime/tools/tool_gateway_client.py)
- [`tool-gateway/workflows/field_cleanup.py`](../tool-gateway/workflows/field_cleanup.py)
- [`tool-gateway/servers/workflows/field_cleanup.py`](../tool-gateway/servers/workflows/field_cleanup.py)
- [`tool-gateway/proposals/field_cleanup.py`](../tool-gateway/proposals/field_cleanup.py)
- [`tool-gateway/proposals/proposal_service.py`](../tool-gateway/proposals/proposal_service.py)
- [`tool-gateway/servers/salesforce/server.py`](../tool-gateway/servers/salesforce/server.py)
- [`tool-gateway/servers/salesforce/field_usage.py`](../tool-gateway/servers/salesforce/field_usage.py)
- [`tool-gateway/servers/salesforce/apex_scanner.py`](../tool-gateway/servers/salesforce/apex_scanner.py)
- [`tool-gateway/servers/salesforce/bulk_scanner.py`](../tool-gateway/servers/salesforce/bulk_scanner.py)
- [`tool-gateway/servers/salesforce/deprecation_service.py`](../tool-gateway/servers/salesforce/deprecation_service.py)
- [`tool-gateway/gateway/api.py`](../tool-gateway/gateway/api.py)
- [`tool-gateway/gateway/service.py`](../tool-gateway/gateway/service.py)
- [`control_plane/routes/proposals.py`](../control_plane/routes/proposals.py)
- [`control_plane/policy_engine.py`](../control_plane/policy_engine.py)
- [`control_plane/audit.py`](../control_plane/audit.py)
- [`control_plane/routes/audit.py`](../control_plane/routes/audit.py)
- [`policy/definitions/sample_field_cleanup_policy.yaml`](../policy/definitions/sample_field_cleanup_policy.yaml)
- [`workflows/sample_deletion_approval_workflow.yaml`](../workflows/sample_deletion_approval_workflow.yaml)
- [`workflows/README.md`](../workflows/README.md)
- [`control-plane/workflow/README.md`](../control-plane/workflow/README.md)
- [`docker-compose.yml`](../docker-compose.yml)
- [`test_integration.py`](../test_integration.py)
