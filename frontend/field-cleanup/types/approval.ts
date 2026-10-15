export interface Approval {
  id: string;
  object: string;
  action: string;
  tier: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  requestedBy?: string;
}
