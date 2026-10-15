import type { Proposal, Agent, ToolDefinition, AuditLogEntry } from "@/types/governance";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, fallback = "Not supplied") => typeof value === "string" ? value : fallback;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function arrayResponse(value: unknown, endpoint: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Unexpected ${endpoint} response: expected an array.`);
  return value;
}

// Convert wire responses to display models without inventing missing business data.
export function proposalView(value: unknown): Proposal {
  const source = row(value);
  const policy = row(source.policy_result);
  const decision = row(source.human_decision);
  return {
    id: text(source.id), agent_id: text(source.agent_id), tool_id: text(source.tool_id),
    status: text(source.status) as Proposal["status"], tier: text(source.tier) as Proposal["tier"],
    input_payload: row(source.input_payload), created_at: text(source.created_at),
    ...(typeof policy.allowed === "boolean" ? { policy_result: {
      allowed: policy.allowed, requires_human_approval: policy.requires_human_approval === true,
      matched_rules: strings(policy.matched_rules), denial_reasons: strings(policy.denial_reasons),
    }} : {}),
    ...(typeof decision.decision === "string" ? { human_decision: {
      decision: decision.decision as "APPROVED" | "REJECTED", reviewer_email: text(decision.reviewer_email),
      reason: text(decision.reason, ""), decided_at: text(decision.decided_at ?? source.decided_at),
    }} : {}),
    ...(source.execution_result != null ? { execution_result: row(source.execution_result) } : {}),
    ...(typeof source.error_message === "string" ? { error_message: source.error_message } : {}),
    ...(typeof source.decided_at === "string" ? { decided_at: source.decided_at } : {}),
    ...(typeof source.executed_at === "string" ? { executed_at: source.executed_at } : {}),
    ...(typeof source.updated_at === "string" ? { updated_at: source.updated_at } : {}),
    ...(typeof source.last_activity_at === "string" ? { last_activity_at: source.last_activity_at } : {}),
  };
}

export function mapReadResponse(path: string, value: unknown): unknown {
  const endpoint = path.split("?")[0].replace(/\/$/, "");
  if (endpoint === "/proposals" || endpoint === "/proposals/queue/pending") {
    return arrayResponse(value, endpoint).map(proposalView);
  }
  if (/^\/proposals\/[^/]+$/.test(endpoint)) return proposalView(value);
  if (endpoint === "/agents") return arrayResponse(value, endpoint).map((value): Agent => {
    const source = row(value);
    return { id: text(source.id ?? source.agent_id), agent_id: text(source.agent_id), name: text(source.name),
      status: text(source.status), version: text(source.version), model_primary: text(source.model_primary), created_at: text(source.created_at),
      ...(typeof source.description === "string" ? { description: source.description } : {}),
      ...(typeof source.owner === "string" ? { owner: source.owner } : {}),
      ...(typeof source.model_fallback === "string" ? { model_fallback: source.model_fallback } : {}),
      ...(typeof source.updated_at === "string" ? { updated_at: source.updated_at } : {}),
    };
  });
  if (endpoint === "/tools") return arrayResponse(value, endpoint).map((value): ToolDefinition => {
    const source = row(value);
    return { id: text(source.id ?? source.tool_id), tool_id: text(source.tool_id), name: text(source.name ?? source.tool_id),
      description: text(source.description), tier: typeof source.tier === "string" && ["Tier-1", "Tier-2", "Tier-3"].includes(source.tier) ? source.tier as ToolDefinition["tier"] : "Not supplied",
      schema_json: row(source.parameters ?? source.schema_json),
      ...(typeof source.mcp_server === "string" ? { mcp_server: source.mcp_server } : {}),
    };
  });
  if (endpoint === "/audit") return arrayResponse(value, endpoint).map((value, index): AuditLogEntry => {
    const source = row(value);
    const details = row(source.payload ?? source.details);
    const createdAt = text(source.created_at ?? source.timestamp);
    const proposalId = source.proposal_id ?? details.proposal_id;
    const signature = source.hmac_signature;
    return {
      id: text(source.id, `${createdAt}:${index}`), created_at: createdAt,
      event_type: text(source.event_type ?? source.action), payload: details,
      actor: text(source.actor ?? details.actor),
      ...(typeof proposalId === "string" ? { proposal_id: proposalId } : {}),
      ...(typeof signature === "string" || signature === null ? { hmac_signature: signature } : {}),
    };
  });
  if (endpoint === "/policies") {
    if (!Array.isArray(value)) {
      const configuration = row(value);
      if (typeof configuration.mode !== "string" || !Array.isArray(configuration.rules)) throw new Error("Unexpected policy response: expected a policy array or a loaded policy configuration.");
      return [{ policy_id: "Loaded policy rules", rules: configuration.rules, mode: configuration.mode }];
    }
    return value.map((value) => {
      const policy = row(value);
      if (typeof policy.policy_id !== "string" || !Array.isArray(policy.rules)) throw new Error("Unexpected policy response: policy_id and rules are required.");
      return { policy_id: policy.policy_id, rules: policy.rules };
    });
  }
  return value;
}

export function proposalAuditEvents(events: AuditLogEntry[], proposalId: string): AuditLogEntry[] {
  return events.filter((event) => event.proposal_id === proposalId)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
}
