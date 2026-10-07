import type {
  Agent,
  AuditLogEntry,
  Proposal,
  ToolDefinition,
} from "@/types/governance";

const DEFAULT_API_BASE = "http://localhost:8000/api/v1";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_API_BASE;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const detail = await response.text();
    let message = detail;

    try {
      const parsed = JSON.parse(detail) as { detail?: string; message?: string };
      message = parsed.detail ?? parsed.message ?? detail;
    } catch {
      // fall back to raw body when the server does not return JSON
    }

    throw new Error(message || `${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type RegisterAgentPayload = {
  agent_id: string;
  name: string;
  version: string;
  description: string;
  owner: string;
  model_primary: string;
  model_fallback: string;
  config_yaml: string;
};

export interface PolicyRule {
  id: string;
  action: string;
  source_file: string;
  tier: string | null;
  conditions: Record<string, unknown>;
  enforcement: Record<string, unknown>;
}

export interface PolicyConfiguration {
  mode: string;
  rule_count: number;
  rules: PolicyRule[];
}

export const GovernanceAPI = {
// ================================================================================================= Policies
  getPolicies: async (): Promise<PolicyConfiguration> => {
    return request<PolicyConfiguration>("/policies/");
  },

// ================================================================================================= Proposals
  getPendingProposals: async (): Promise<Proposal[]> => {
    return request<Proposal[]>("/proposals/");
  },

  listProposals: async (params?: { status?: string; agent_id?: string }): Promise<Proposal[]> => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.agent_id) search.set("agent_id", params.agent_id);

    const query = search.toString();
    return request<Proposal[]>(`/proposals/${query ? `?${query}` : ""}`);
  },

  getProposal: async (id: string): Promise<Proposal> => {
    return request<Proposal>(`/proposals/${encodeURIComponent(id)}`);
  },

  submitDecision: async (
    proposalId: string,
    decision: "APPROVED" | "REJECTED",
    reviewerEmail: string,
    reason: string,
  ): Promise<Proposal> => {
    return request<Proposal>(`/proposals/${encodeURIComponent(proposalId)}/decide`, {
      method: "PUT",
      body: JSON.stringify({
        decision,
        reviewer_email: reviewerEmail,
        reason,
      }),
    });
  },

  executeProposal: async (proposalId: string): Promise<Proposal> => {
    return request<Proposal>(`/proposals/${encodeURIComponent(proposalId)}/execute`, {
      method: "POST",
    });
  },

// ================================================================================================= Audit Log
  getAuditLog: async (limit = 50): Promise<AuditLogEntry[]> => {
    return request<AuditLogEntry[]>(`/audit/?limit=${encodeURIComponent(String(limit))}`);
  },

// ================================================================================================= Agents
  getAgents: async (): Promise<Agent[]> => {
    return request<Agent[]>("/agents/");
  },

  getAgent: async (agentId: string): Promise<Agent> => {
    return request<Agent>(`/agents/${encodeURIComponent(agentId)}`);
  },

  registerAgent: async (payload: RegisterAgentPayload): Promise<Agent> => {
    return request<Agent>("/agents/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateAgentStatus: async (
    agentId: string,
    status: Agent["status"],
  ): Promise<{ agent_id: string; status: Agent["status"] }> => {
    const query = new URLSearchParams({ status });
    return request<{ agent_id: string; status: Agent["status"] }>(
      `/agents/${encodeURIComponent(agentId)}/status?${query.toString()}`,
      { method: "PATCH" },
    );
  },

// ================================================================================================= Tools

  getTools: async (): Promise<ToolDefinition[]> => {
    return request<ToolDefinition[]>("/tools/");
  },
};

export default GovernanceAPI;