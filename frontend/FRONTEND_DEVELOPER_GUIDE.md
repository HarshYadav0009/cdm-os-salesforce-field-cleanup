# 🎨 Frontend Developer Guide — Governance & Approval Dashboard

> **Target Audience:** Frontend Engineer (Dev 3)  
> **Backend Base URL:** `http://localhost:8000` (Control Plane API)  
> **Tool Gateway Base URL:** `http://localhost:8080` (MCP Tool Gateway)  
> **Allowed CORS Origins:** `http://localhost:5173`, `http://localhost:3000`  

---

## 🚀 1. Quick Start Setup

### Step 1: Initialize Vite + React + TypeScript in `frontend/`

```bash
# Navigate to the frontend folder
cd frontend

# Initialize React TypeScript app (if not already done)
npx -y create-vite@latest . --template react-ts

# Install required dependencies
npm install
npm install axios lucide-react @tanstack/react-query clsx tailwindmerge
```

### Step 2: Start Development Server

```bash
npm run dev
```
The app will run at `http://localhost:5173`.

---

## 📐 2. TypeScript Interfaces & Data Contracts

Copy these interfaces into `src/types/governance.ts`:

```typescript
// --- Permission Tiers ---
export type ToolTier = 'Tier-1' | 'Tier-2' | 'Tier-3';

// --- Proposal Statuses ---
export type ProposalStatus =
  | 'PROPOSED'
  | 'POLICY_APPROVED'
  | 'POLICY_DENIED'
  | 'PENDING_HUMAN_APPROVAL'
  | 'HUMAN_APPROVED'
  | 'HUMAN_REJECTED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK';

// --- Policy Engine Evaluation Output ---
export interface PolicyResult {
  allowed: boolean;
  requires_human_approval: boolean;
  matched_rules: string[];
  denial_reasons: string[];
}

// --- Human Decision Record ---
export interface HumanDecisionRecord {
  decision: 'APPROVED' | 'REJECTED';
  reviewer_email: string;
  reason: string;
  decided_at: string;
}

// --- Core Proposal Entity ---
export interface Proposal {
  id: string;
  agent_id: string;
  tool_id: string;
  status: ProposalStatus;
  tier: ToolTier;
  input_payload: Record<string, any>;
  policy_result?: PolicyResult;
  human_decision?: HumanDecisionRecord;
  execution_result?: Record<string, any>;
  error_message?: string;
  created_at: string;
  decided_at?: string;
  executed_at?: string;
}

// --- Registered Agent Definition ---
export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  version: string;
  description?: string;
  owner?: string;
  model_primary: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'TERMINATED';
  created_at: string;
}

// --- Registered Tool Definition ---
export interface ToolDefinition {
  id: string;
  tool_id: string;
  name: string;
  description?: string;
  tier: ToolTier;
  mcp_server: string;
  schema_json?: Record<string, any>;
}

// --- HMAC Audit Log Entry ---
export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor: string;
  proposal_id?: string;
  payload: Record<string, any>;
  hmac_signature: string;
  created_at: string;
}
```

---

## 🌐 3. API Service Integration Module

Create `src/services/api.ts` for all backend requests:

```typescript
import axios from 'axios';
import { Proposal, Agent, ToolDefinition, AuditLogEntry } from '../types/governance';

const API_BASE = 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const GovernanceAPI = {
  // 1. Fetch pending proposals queue (Primary for Approval Dashboard)
  getPendingProposals: async (): Promise<Proposal[]> => {
    const res = await client.get<Proposal[]>('/proposals/queue/pending');
    return res.data;
  },

  // 2. Fetch all proposals with optional filters
  listProposals: async (params?: { status?: string; agent_id?: string }): Promise<Proposal[]> => {
    const res = await client.get<Proposal[]>('/proposals/', { params });
    return res.data;
  },

  // 3. Get single proposal details
  getProposal: async (id: string): Promise<Proposal> => {
    const res = await client.get<Proposal>(`/proposals/${id}`);
    return res.data;
  },

  // 4. Submit Human Approval / Rejection Decision
  submitDecision: async (
    proposalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewerEmail: string,
    reason: string
  ): Promise<Proposal> => {
    const res = await client.put<Proposal>(`/proposals/${proposalId}/decide`, {
      decision,
      reviewer_email: reviewerEmail,
      reason,
    });
    return res.data;
  },

  // 5. Trigger Execution for Approved Proposal
  executeProposal: async (proposalId: string): Promise<Proposal> => {
    const res = await client.post<Proposal>(`/proposals/${proposalId}/execute`);
    return res.data;
  },

  // 6. Fetch System Audit Log
  getAuditLog: async (limit = 50): Promise<AuditLogEntry[]> => {
    const res = await client.get<AuditLogEntry[]>('/audit/', { params: { limit } });
    return res.data;
  },

  // 7. List Registered Agents & Tools
  getAgents: async (): Promise<Agent[]> => {
    const res = await client.get<Agent[]>('/agents/');
    return res.data;
  },

  getTools: async (): Promise<ToolDefinition[]> => {
    const res = await client.get<ToolDefinition[]>('/tools/');
    return res.data;
  }
};
```

---

## 🖥️ 4. Key UI Screens to Build

### Screen 1: **Governance Approval Queue (`/approvals`)**
- **Purpose:** Display all proposals in `PENDING_HUMAN_APPROVAL` status.
- **Key UI Elements:**
  - **Risk Tier Badges:**
    - `Tier-1`: 🟢 Green (Read-only, Auto-approved)
    - `Tier-2`: 🟡 Yellow (Modifying operation, Policy gated)
    - `Tier-3`: 🔴 Red (Destructive action e.g. `salesforce_delete_field` — HITL Required!)
  - **Payload Context Viewer:** Show `object_api_name`, `field_api_name`, record usage %, and zero usage flag.
  - **Action Buttons:** "Approve" (opens Modal) and "Reject" (opens Modal).

### Screen 2: **Decision Confirmation Modal (`ApprovalModal.tsx`)**
- **Form Inputs:**
  1. `reviewer_email` (Text input — e.g. `lead-admin@company.com`)
  2. `reason` (Textarea — e.g. `Verified zero field population in sandbox & prod over 90 days`)
- **Submission:** Calls `GovernanceAPI.submitDecision(...)`, then optionally triggers `GovernanceAPI.executeProposal(...)`.

### Screen 3: **Audit Trail & Integrity Log (`/audit`)**
- **Purpose:** Show immutable, tamper-evident event log.
- **Key UI Elements:**
  - Event type timeline (`PROPOSAL_CREATED`, `POLICY_CHECK`, `HUMAN_DECISION`, `TOOL_EXECUTED`).
  - **HMAC SHA-256 Badge:** Display truncated signature with copy button (`hmac_signature.slice(0, 16)...`).

---

## ⚡ 5. Verification Checklist for Frontend Testing

When testing your UI against the local server:

1. **Start Backend Stack:**
   ```bash
   docker compose up -d
   ```
2. **Run Test Proposal Generator:**
   ```bash
   python test_integration.py
   ```
   *This inserts sample Tier-1 and Tier-3 proposals into your DB queue.*
3. **Verify UI Functionality:**
   - Open `http://localhost:5173` in browser.
   - Navigate to **Pending Approvals Queue**. You should see proposal `salesforce_delete_field`.
   - Click **Approve**, enter email `admin@enterprise.com`, and submit.
   - Verify proposal status updates to `HUMAN_APPROVED` / `EXECUTING`.
   - Open **Audit Log tab** and verify the `HUMAN_DECISION` audit entry with HMAC signature appears.
