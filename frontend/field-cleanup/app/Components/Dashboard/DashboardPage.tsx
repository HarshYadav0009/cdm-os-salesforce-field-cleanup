import StatusBar from "./StatusBar";
import StatCard from "./StatCard";
import FieldTable from "./FieldTable";
import ApprovalQueueSummary from "./ApprovalQueueSummary";
import RecentAuditActivity from "./RecentAuditActivity";

/* ---- Mock data (replace with real data / fetch later) ---- */
const STATUS_ITEMS = [
  {
    label: "Agent Status",
    value: "ACTIVE",
    hint: "(Halted, Tier 3 Action)",
    valueClass: "text-emerald-400",
  },
  { label: "Environment", value: "LOCAL (Docker)" },
  { label: "Active Approver", value: "Developer 3 / Approver" },
];

const STATS = [
  { label: "Total Cleanup Jobs", value: 24 },
  { label: "Pending Approvals", value: 5 },
  { label: "Field Scanned (Last 15 Days)", value: 1240 },
];

const JOBS = [
  {
    id: "Job 101",
    object: "Account",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
  {
    id: "Job 102",
    object: "Contact",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
  {
    id: "Job 103",
    object: "Lead",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
  {
    id: "Job 104",
    object: "Account",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
  {
    id: "Job 105",
    object: "Case",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
  {
    id: "Job 106",
    object: "Account",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
  {
    id: "Job 107",
    object: "Opportunity",
    status: "Fieldspy Analysis Running",
    candidateFields: 2,
  },
];

const APPROVALS = [
  {
    id: "a1",
    object: "Account",
    action: "salesforce_delete",
    tier: 3,
    risk: "HIGH" as const,
  },
  {
    id: "a2",
    object: "Contact",
    action: "salesforce_delete",
    tier: 3,
    risk: "HIGH" as const,
  },
  {
    id: "a3",
    object: "Lead",
    action: "salesforce_delete",
    tier: 3,
    risk: "HIGH" as const,
  },
];

const AUDIT_ITEMS = [
  {
    id: "l1",
    time: "09:30:12",
    message: "FieldSpy Analysis Started. (Account)",
    source: "System log",
  },
  {
    id: "l2",
    time: "09:15:05",
    message: "Policy Escalation to HITL (Tier 3 action)",
    source: "Audit",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <h1 className="p-1 text-xl font-bold sm:text-2xl">Dashboard</h1>

      <div className="rounded-lg bg-slate-900 p-2 border border-slate-700 space-y-4">
        {/* Top status bar */}
        <StatusBar items={STATUS_ITEMS} />

        {/* Stats grid — responsive: 1 col on mobile, 3 on large */}
        <div className="px-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STATS.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>

        {/* Bottom section — stacks on mobile, side by side on large */}
        <div className="flex flex-col lg:flex-row gap-4 p-2">
          <div className="lg:flex-1 min-w-0">
            <FieldTable jobs={JOBS} />
          </div>
          <div className="flex flex-col gap-5 lg:w-[420px] xl:w-[460px]">
            <ApprovalQueueSummary approvals={APPROVALS} />
            <RecentAuditActivity activities={AUDIT_ITEMS} />
          </div>
        </div>
      </div>
    </div>
  );
}
