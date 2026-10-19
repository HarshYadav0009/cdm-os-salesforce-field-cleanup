import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadApi(fetch) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, fetch, URLSearchParams, setTimeout, clearTimeout,
      process: { env: { NEXT_PUBLIC_CONTROL_PLANE_URL: "http://api.test" } },
      require: (name) => load(path.resolve(path.dirname(file), `${name}.ts`)),
    });
    return exports;
  }
  return { ...load(path.join(root, "app/lib/api/governance.ts")), ...load(path.join(root, "app/lib/api/contracts.ts")) };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const proposal = { id: "p1", agent_id: "a1", tool_id: "tool1", status: "PROPOSED", tier: "Tier-1",
  input_payload: {}, policy_result: {}, human_decision: {}, execution_result: {}, created_at: "2026-10-15T11:00:04.981Z" };

test("proposal creation, decisions and execution use the supplied wire contracts", async () => {
  const calls = [];
  const { GovernanceAPI, getRecordedDecision } = loadApi(async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith("/decide")) return Response.json({ status: "DECIDED", decided_at: proposal.created_at });
    if (url.endsWith("/execute")) return Response.json({ execution_id: "e1", status: "SUCCESS", result: { done: true } });
    return Response.json(proposal);
  });
  const payload = { agent_id: "a1", tool_id: "tool1", input_payload: { field: "Legacy__c" } };
  const created = await GovernanceAPI.createProposal(payload);
  assert.equal(created.policy_result, undefined);
  assert.equal(created.human_decision, undefined);
  const decision = await GovernanceAPI.submitDecision("p1", "APPROVED", "Reviewed");
  assert.equal(decision.status, "DECIDED");
  assert.equal(getRecordedDecision("p1"), "APPROVED");
  const execution = await GovernanceAPI.executeProposal("p1");
  assert.deepEqual(plain(execution), { execution_id: "e1", status: "SUCCESS", result: { done: true } });
  assert.deepEqual(calls, [
    { url: "http://api.test/api/v1/proposals/", method: "POST", body: payload },
    { url: "http://api.test/api/v1/proposals/p1/decide", method: "PUT", body: { decision: "APPROVED", reason: "Reviewed" } },
    { url: "http://api.test/api/v1/proposals/p1/execute", method: "POST", body: undefined },
  ]);
});

test("proposal summaries load details before field and execution views consume them", async () => {
  const calls = [];
  const { GovernanceAPI } = loadApi(async (url) => {
    calls.push(url);
    return Response.json(url.endsWith("/proposals/")
      ? [{ id: "p1", agent_id: "a1", status: "PROPOSED", created_at: proposal.created_at }]
      : proposal);
  });
  const list = await GovernanceAPI.listProposals();
  assert.equal(list[0].tool_id, "tool1");
  assert.deepEqual(calls, ["http://api.test/api/v1/proposals/", "http://api.test/api/v1/proposals/p1"]);
});

test("agent registration and status updates send only the new body fields", async () => {
  const calls = [];
  const { GovernanceAPI } = loadApi(async (url, init) => {
    calls.push({ url, method: init.method, body: JSON.parse(init.body) });
    return Response.json({ agent_id: "a1", status: "registered" });
  });
  const payload = { name: "Cleanup", type: "salesforce", config: { tools: [] } };
  assert.equal((await GovernanceAPI.registerAgent(payload)).agent_id, "a1");
  await GovernanceAPI.updateAgentStatus("a1", "active");
  assert.deepEqual(calls, [
    { url: "http://api.test/api/v1/agents/", method: "POST", body: payload },
    { url: "http://api.test/api/v1/agents/a1/status", method: "PATCH", body: { status: "active" } },
  ]);
});

test("minimal agents, tool parameters, audit events and policy arrays map to usable views", async () => {
  const { GovernanceAPI } = loadApi(async (url) => {
    if (url.endsWith("/agents/")) return Response.json([{ agent_id: "a1", name: "Cleanup", status: "active" }]);
    if (url.endsWith("/tools/")) return Response.json([{ tool_id: "tool1", description: "Read fields", parameters: { object_name: { type: "string" } } }]);
    if (url.includes("/audit/")) return Response.json([{ timestamp: proposal.created_at, action: "CREATED", details: { proposal_id: "p1" } }]);
    return Response.json([{ policy_id: "policy1", rules: [{ action: "read" }] }]);
  });
  const agent = (await GovernanceAPI.getAgents())[0];
  assert.equal(agent.status, "active");
  assert.equal(agent.model_primary, "Not supplied");
  const tool = (await GovernanceAPI.getTools())[0];
  assert.equal(tool.tier, "Not supplied");
  assert.deepEqual(plain(tool.schema_json), { object_name: { type: "string" } });
  const audit = (await GovernanceAPI.getAuditLog())[0];
  assert.equal(audit.event_type, "CREATED");
  assert.equal(audit.created_at, proposal.created_at);
  assert.equal(audit.hmac_signature, undefined);
  assert.equal(audit.actor, "Not supplied");
  assert.deepEqual(plain(await GovernanceAPI.getPolicies()), [{ policy_id: "policy1", rules: [{ action: "read" }] }]);
});

test("audit verification sends proposal ID and token and accepts an unspecified empty response", async () => {
  let sent;
  const { GovernanceAPI } = loadApi(async (url, init) => {
    sent = { url, method: init.method, body: JSON.parse(init.body) };
    return new Response(null, { status: 200 });
  });
  assert.equal(await GovernanceAPI.verifyAudit("p1", "token1"), undefined);
  assert.deepEqual(sent, { url: "http://api.test/api/v1/audit/verify", method: "POST", body: { proposal_id: "p1", verification_token: "token1" } });
});

test("loaded policy configuration is supported alongside policy arrays", async () => {
  const { GovernanceAPI } = loadApi(async () => Response.json({ mode: "enforce", rule_count: 1, rules: [{ id: "require-review" }] }));
  const policies = await GovernanceAPI.getPolicies();
  assert.equal(policies[0].mode, "enforce");
  assert.deepEqual(plain(policies[0].rules), [{ id: "require-review" }]);
});

test("a rejected decision never records approval or dispatches execution", async () => {
  const calls = [];
  const { GovernanceAPI, getRecordedDecision } = loadApi(async (url) => {
    calls.push(url);
    return Response.json({ status: "DECIDED", decided_at: proposal.created_at });
  });
  await GovernanceAPI.submitDecision("p1", "REJECTED", "Dependencies unresolved");
  assert.equal(getRecordedDecision("p1"), "REJECTED");
  assert.deepEqual(calls, ["http://api.test/api/v1/proposals/p1/decide"]);
});

test("asynchronous execution polls the same proposal through completion without repeating POST", async () => {
  const calls = [];
  let reads = 0;
  const { GovernanceAPI, waitForExecution } = loadApi(async (url, init) => {
    calls.push({ url, method: init.method ?? "GET" });
    if (init.method === "POST") return Response.json({ ...proposal, status: "EXECUTING", execution_result: null });
    reads += 1;
    return Response.json({ ...proposal, status: reads === 1 ? "EXECUTING" : "COMPLETED", execution_result: reads === 1 ? null : { changed: true } });
  });
  const started = await GovernanceAPI.executeProposal("p1");
  assert.equal(started.status, "EXECUTING");
  assert.equal(started.execution_id, undefined);
  const completed = await waitForExecution("p1", started, { intervalMs: 0, maxAttempts: 3 });
  assert.equal(completed.status, "SUCCESS");
  assert.deepEqual(plain(completed.result), { changed: true });
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls.filter((call) => call.method === "GET").length, 2);
  assert.ok(calls.filter((call) => call.method === "GET").every((call) => call.url.endsWith("/proposals/p1")));
});

test("asynchronous failures retain backend error messages and polling timeouts remain in progress", async () => {
  for (const status of ["FAILED", "EXECUTING"]) {
    const { GovernanceAPI, waitForExecution } = loadApi(async (_url, init) => Response.json({
      ...proposal, status: init.method === "POST" ? "EXECUTING" : status,
      error_message: status === "FAILED" ? "Salesforce denied field update" : null,
    }));
    const started = await GovernanceAPI.executeProposal("p1");
    const result = await waitForExecution("p1", started, { intervalMs: 0, maxAttempts: 2 });
    assert.equal(result.status, status);
    if (status === "FAILED") assert.equal(result.error_message, "Salesforce denied field update");
  }
});

test("immediate success and completed proposal responses do not need polling", async () => {
  for (const response of [
    { execution_id: "e1", status: "SUCCESS", result: { done: true } },
    { ...proposal, status: "COMPLETED", execution_result: { done: true } },
  ]) {
    let requests = 0;
    const { GovernanceAPI, waitForExecution } = loadApi(async () => {
      requests += 1;
      return Response.json(response);
    });
    const result = await waitForExecution("p1", await GovernanceAPI.executeProposal("p1"), { intervalMs: 0 });
    assert.equal(result.status, "SUCCESS");
    assert.deepEqual(plain(result.result), { done: true });
    assert.equal(requests, 1);
  }
});

test("approval and rejection include reviewer email for the repository backend", async () => {
  for (const decision of ["APPROVED", "REJECTED"]) {
    const calls = [];
    const { GovernanceAPI, getRecordedDecision } = loadApi(async (url, init) => {
      calls.push({ url, method: init.method, body: JSON.parse(init.body) });
      return Response.json({ ...proposal, status: decision === "APPROVED" ? "HUMAN_APPROVED" : "HUMAN_REJECTED", decided_at: proposal.created_at });
    });
    const result = await GovernanceAPI.submitDecision("p1", decision, "Reviewed dependencies", " reviewer@example.test ");
    assert.equal(result.status, decision === "APPROVED" ? "HUMAN_APPROVED" : "HUMAN_REJECTED");
    assert.equal(getRecordedDecision("p1"), decision);
    assert.deepEqual(calls, [{ url: "http://api.test/api/v1/proposals/p1/decide", method: "PUT", body: {
      decision, reason: "Reviewed dependencies", reviewer_email: "reviewer@example.test",
    } }]);
  }
});

test("422 responses display missing field names without exposing rejected input values", async () => {
  const { GovernanceAPI } = loadApi(async () => Response.json({ detail: [{
    loc: ["body", "reviewer_email"], msg: "Field required", type: "missing", input: { reason: "private reason" },
  }] }, { status: 422, statusText: "Unprocessable Entity" }));
  await assert.rejects(GovernanceAPI.submitDecision("p1", "REJECTED", "Reviewed"), (error) => {
    assert.match(error.message, /422 Unprocessable Entity: reviewer_email: Field required/);
    assert.ok(!error.message.includes("private reason"));
    return true;
  });
});

test("rejected history uses backend filtering and pagination beyond the default first fifty records", async () => {
  const calls = [];
  const rejected = { ...proposal, id: "old-rejected", status: "HUMAN_REJECTED", human_decision: { decision: "REJECTED", reason: "Dependencies remain" } };
  const { GovernanceAPI } = loadApi(async (url) => {
    calls.push(url);
    assert.equal(url, "http://api.test/api/v1/proposals/?status=HUMAN_REJECTED&limit=15&offset=60");
    return Response.json([rejected]);
  });
  const result = await GovernanceAPI.listProposals({ status: "HUMAN_REJECTED", limit: 15, offset: 60 });
  assert.equal(result[0].id, "old-rejected");
  assert.equal(result[0].status, "HUMAN_REJECTED");
  assert.equal(result[0].human_decision.decision, "REJECTED");
  assert.equal(calls.length, 1);
});

test("a supplemental detail failure does not remove a rejected proposal from history", async () => {
  const { GovernanceAPI } = loadApi(async (url) => url.endsWith("/proposals/")
    ? Response.json([{ id: "p1", agent_id: "a1", status: "HUMAN_REJECTED", created_at: proposal.created_at }])
    : Response.json({ detail: "Temporarily unavailable" }, { status: 503 }));
  const result = await GovernanceAPI.listProposals();
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "HUMAN_REJECTED");
});

test("document audit events preserve signed payloads, identities, proposal links and timestamps", async () => {
  const event = { id: "audit1", event_type: "HUMAN_DECISION", actor: "reviewer@example.test", proposal_id: "p1",
    payload: { decision: "REJECTED", reason: "Field remains in use", tier: "Tier-3" }, hmac_signature: "abcdef0123456789".repeat(4), created_at: proposal.created_at };
  const { GovernanceAPI } = loadApi(async (url) => {
    assert.equal(url, "http://api.test/api/v1/audit/?limit=50");
    return Response.json([event]);
  });
  assert.deepEqual(plain((await GovernanceAPI.getAuditLog())[0]), event);
});

test("mixed audit contracts keep null signatures and link compact events without inventing signatures", async () => {
  const { GovernanceAPI } = loadApi(async () => Response.json([
    { id: "audit1", event_type: "PROPOSAL_CREATED", actor: "agent", proposal_id: "p1", payload: {}, hmac_signature: null, created_at: proposal.created_at },
    { timestamp: proposal.created_at, action: "HUMAN_DECISION", details: { actor: "reviewer", proposal_id: "p1", decision: "APPROVED" } },
  ]));
  const events = await GovernanceAPI.getAuditLog();
  assert.equal(events[0].id, "audit1");
  assert.equal(events[0].hmac_signature, null);
  assert.equal(events[1].proposal_id, "p1");
  assert.equal(events[1].event_type, "HUMAN_DECISION");
  assert.equal(events[1].hmac_signature, undefined);
});

test("proposal timeline includes the linked lifecycle in time order and excludes other proposals", async () => {
  const stages = ["PROPOSAL_CREATED", "POLICY_CHECK", "HUMAN_DECISION", "EXECUTION_STARTED", "TOOL_EXECUTED", "EXECUTION_VERIFIED"];
  const raw = stages.map((event_type, index) => ({ id: `event${index}`, event_type, actor: "system", proposal_id: "p1",
    payload: {}, hmac_signature: "sig", created_at: `2026-10-15T11:00:0${index}.000Z` }));
  const { GovernanceAPI, proposalAuditEvents } = loadApi(async () => Response.json([...raw].reverse().concat({ ...raw[0], id: "other", proposal_id: "p2" })));
  const events = proposalAuditEvents(await GovernanceAPI.getAuditLog(), "p1");
  assert.deepEqual(plain(events.map((event) => event.event_type)), stages);
  assert.deepEqual(plain(proposalAuditEvents(events, "missing")), []);
});


test("repository agent metadata and tool tiers are retained when the live service supplies them", async () => {
  const { GovernanceAPI } = loadApi(async (url) => Response.json(url.includes("/agents/")
    ? [{ id: "db-agent", agent_id: "a1", name: "Cleanup", status: "RUNNING", version: "1.0", model_primary: "configured-model", owner: "team", created_at: proposal.created_at }]
    : [{ id: "db-tool", tool_id: "tool1", name: "Read fields", tier: "Tier-1", mcp_server: "salesforce", description: "Read" }]));
  const agent = (await GovernanceAPI.getAgents())[0];
  assert.equal(agent.owner, "team");
  assert.equal(agent.model_primary, "configured-model");
  const tool = (await GovernanceAPI.getTools())[0];
  assert.equal(tool.tier, "Tier-1");
  assert.equal(tool.name, "Read fields");
});
