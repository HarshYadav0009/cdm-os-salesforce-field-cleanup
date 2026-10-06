export type HmacStatus = "Present" | "Missing";

export type RiskTier = string;

export interface AuditLog {
  id: string | number;
  timestamp: string;
  workflowId: string;
  actor: string;
  actionType: string;       // may include "\n" — render with whitespace-pre-wrap
  resource?: string;
  detailsText?: string;     // raw JSON snippet
  riskTier: RiskTier;
  hmacStatus: HmacStatus;
  hmacSignature?: string;
  /** When true → row highlighted as alert */
  isAlert?: boolean;
}

export interface AuditInfoCard {
  id: string;
  title: string;
  label: string;
  value: string;
}