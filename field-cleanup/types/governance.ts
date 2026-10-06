export type ToolTier = "Tier-1" | "Tier-2" | "Tier-3";

export type ProposalStatus =
  | "PROPOSED"
  | "POLICY_APPROVED"
  | "POLICY_DENIED"
  | "PENDING_HUMAN_APPROVAL"
  | "HUMAN_APPROVED"
  | "HUMAN_REJECTED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK";

export interface PolicyResult {
  allowed: boolean;
  requires_human_approval: boolean;
  matched_rules: string[];
  denial_reasons: string[];
}

export interface HumanDecisionRecord {
  decision: "APPROVED" | "REJECTED";
  reviewer_email: string;
  reason: string;
  decided_at: string;
}

export interface Proposal {
  id: string;
  agent_id: string;
  tool_id: string;
  status: ProposalStatus;
  tier: ToolTier;
  input_payload: Record<string, unknown>;
  policy_result?: PolicyResult;
  human_decision?: HumanDecisionRecord;
  execution_result?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
  decided_at?: string;
  executed_at?: string;
}

export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  version: string;
  description?: string;
  owner?: string;
  model_primary: string;
  model_fallback?: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "ERROR" | "TERMINATED";
  created_at: string;
  updated_at?: string;
}

export interface ToolDefinition {
  id: string;
  tool_id: string;
  name: string;
  description?: string;
  tier: ToolTier;
  mcp_server?: string;
  schema_json?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor: string;
  proposal_id?: string;
  payload: Record<string, unknown>;
  hmac_signature?: string | null;
  created_at: string;
}
