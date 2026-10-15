import type {
  Agent,
  AuditLogEntry,
  Proposal,
  ToolDefinition,
} from "@/types/governance";

import { gatewayArguments } from "./gatewayResponse";
import { proposalView } from "./contracts";
import { api as request } from "./client";

export type RegisterAgentPayload = { name: string; type: string; config: Record<string, unknown> };
export interface PolicyConfiguration { policy_id: string; rules: unknown[]; mode?: string }
const recordedDecisions = new Map<string, "APPROVED" | "REJECTED">();
export const getRecordedDecision = (proposalId: string) => recordedDecisions.get(proposalId);

export interface DecisionResponse { status: "DECIDED" | "HUMAN_APPROVED" | "HUMAN_REJECTED"; decided_at: string }
export interface ExecutionResponse {
  execution_id?: string;
  result: Record<string, unknown>;
  status: "SUCCESS" | "FAILED" | "EXECUTING";
  error_message?: string;
}

export function executionResponse(value: unknown): ExecutionResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid execution response.");
  const source = value as Record<string, unknown>;
  const status = source.status === "COMPLETED" ? "SUCCESS" : source.status;
  if (status !== "SUCCESS" && status !== "FAILED" && status !== "EXECUTING") {
    throw new Error(`Unexpected execution status: ${String(source.status)}. Check the proposal before retrying.`);
  }
  const result = source.result ?? source.execution_result;
  return {
    status,
    result: result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {},
    ...(typeof source.execution_id === "string" ? { execution_id: source.execution_id } : {}),
    ...(typeof source.error_message === "string" ? { error_message: source.error_message } : {}),
  };
}

// Poll only the existing proposal. Never repeat the execution POST.
export async function waitForExecution(
  proposalId: string,
  initial: ExecutionResponse,
  { intervalMs = 2000, maxAttempts = 150 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<ExecutionResponse> {
  let current = initial;
  for (let attempt = 0; current.status === "EXECUTING" && attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const proposal = await GovernanceAPI.getProposal(proposalId);
    current = { ...executionResponse(proposal), ...(current.execution_id ? { execution_id: current.execution_id } : {}) };
  }
  return current;
}
export interface AuditVerificationResponse { [key: string]: unknown }

export interface CreateProposalPayload {
  agent_id: string;
  tool_id: string;
  input_payload: Record<string, unknown>;
}

export const GovernanceAPI = {
// ================================================================================================= Policies
  getPolicies: async (signal?: AbortSignal): Promise<PolicyConfiguration[]> => {
    return request<PolicyConfiguration[]>("/policies/", { signal, cache: "no-store" });
  },

// ================================================================================================= Proposals
  getPendingProposals: async (): Promise<Proposal[]> => {
    return request<Proposal[]>("/proposals/queue/pending");
  },

  listProposals: async (params?: { status?: string; agent_id?: string; limit?: number; offset?: number }): Promise<Proposal[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.agent_id) query.set("agent_id", params.agent_id);
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    return request<Proposal[]>(`/proposals/${query.size ? `?${query}` : ""}`);
  },

  getProposal: async (id: string): Promise<Proposal> => {
    return request<Proposal>(`/proposals/${encodeURIComponent(id)}`);
  },

  createProposal: async (payload: CreateProposalPayload): Promise<Proposal> => {
    return proposalView(await request<unknown>("/proposals/", {
      method: "POST",
      body: JSON.stringify({ ...payload, input_payload: gatewayArguments(payload.tool_id, payload.input_payload) }),
    }));
  },

  submitDecision: async (
    proposalId: string,
    decision: "APPROVED" | "REJECTED",
    reason: string,
    reviewerEmail?: string,
  ): Promise<DecisionResponse> => {
    const result = await request<DecisionResponse>(`/proposals/${encodeURIComponent(proposalId)}/decide`, {
      method: "PUT",
      body: JSON.stringify({
        decision,
        reason,
        ...(reviewerEmail?.trim() ? { reviewer_email: reviewerEmail.trim() } : {}),
      }),
    });
    if (["DECIDED", "HUMAN_APPROVED", "HUMAN_REJECTED"].includes(result.status)) recordedDecisions.set(proposalId, decision);
    return result;
  },

  executeProposal: async (proposalId: string): Promise<ExecutionResponse> => {
    return executionResponse(await request<unknown>(`/proposals/${encodeURIComponent(proposalId)}/execute`, {
      method: "POST",
    }));
  },

  verifyAudit: (proposal_id: string, verification_token: string) =>
    request<AuditVerificationResponse>("/audit/verify", {
      method: "POST", body: JSON.stringify({ proposal_id, verification_token }),
    }),

// ================================================================================================= Audit Log
  getAuditLog: async (limit = 50): Promise<AuditLogEntry[]> => request<AuditLogEntry[]>(`/audit/?limit=${encodeURIComponent(String(limit))}`),

// ================================================================================================= Agents
  getAgents: async (): Promise<Agent[]> => {
    return request<Agent[]>("/agents/");
  },

  getAgent: async (agentId: string): Promise<Agent> => {
    const agents = await request<Agent[]>("/agents/");
    const agent = agents.find((item) => item.agent_id === agentId);
    if (!agent) throw new Error("Agent not found.");
    return agent;
  },

  registerAgent: async (payload: RegisterAgentPayload): Promise<{ agent_id: string; status: string }> => {
    return request<{ agent_id: string; status: string }>("/agents/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateAgentStatus: async (
    agentId: string,
    status: Agent["status"],
  ): Promise<{ agent_id: string; status: Agent["status"] }> => {
    return request<{ agent_id: string; status: string }>(
      `/agents/${encodeURIComponent(agentId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
  },

// ================================================================================================= Tools

  getTools: async (): Promise<ToolDefinition[]> => {
    return request<ToolDefinition[]>("/tools/");
  },
};

export default GovernanceAPI;