export interface Agent {
  id: string;
  name: string;
  status: "ACTIVE" | "HALTED" | "IDLE";
  tier: number;
  guardian: string;
  lastActivity: string;
}
