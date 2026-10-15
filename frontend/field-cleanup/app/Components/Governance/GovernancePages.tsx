"use client";
import TablePagination, { useTablePagination } from "@/app/Components/shared/TablePagination";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Clock3,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { GovernanceAPI } from "@/app/lib/api/governance";
import type { PolicyConfiguration } from "@/app/lib/api/governance";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";
import { useToast } from "@/app/Components/Toast/useToast";
import type {
  Agent as ControlPlaneAgent,
  AuditLogEntry,
  Proposal,
  ToolDefinition,
} from "@/types/governance";

type AgentStatus = ControlPlaneAgent["status"];
type Agent = {
  id: string;
  name: string;
  skill: string;
  status: AgentStatus;
  // tier: string;
  guardian: string;
  activity: string;
  model: string;
  agent_id: string;
  version: string;
  owner?: string;
  model_primary: string;
  model_fallback?: string;
  created_at: string;
  updated_at?: string;
  description?: string;
};

function toAgentView(agent: ControlPlaneAgent): Agent {
  return {
    id: agent.id,
    agent_id: agent.agent_id,
    name: agent.name,
    skill: agent.description ?? "Registered control-plane agent",
    status: agent.status,
    // tier: "Set by registered tools",
    guardian: agent.owner ?? "Unassigned",
    activity: `Current state: ${agent.status}`,
    model: agent.model_primary,
    model_primary: agent.model_primary,
    model_fallback: agent.model_fallback,
    version: agent.version,
    owner: agent.owner,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    description: agent.description,
  };
}

export function SourceNotice({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  if (loading) {
    return (
      <div
        role="status"
        className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-200"
      >
        Connecting to the control plane…
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200"
      >
        <span>
          Live data unavailable ({error}). Retry to load current records.
        </span>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-amber-400/30 px-2.5 py-1.5 font-semibold hover:bg-amber-400/10"
        >
          Retry
        </button>
      </div>
    );
  }
  return null;
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/80">
      <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  change,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  change: string;
  icon: typeof Bot;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-300 ring-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    red: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`rounded-lg p-2 ring-1 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
        {change}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const tone =
    ["active", "running"].includes(status.toLowerCase())
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "ERROR"
        ? "bg-red-500/10 text-red-300"
        : status === "PAUSED"
          ? "bg-amber-400/10 text-amber-300"
            : status === "TERMINATED"
              ? "bg-rose-500/10 text-rose-300"
          : "bg-slate-700/70 text-slate-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${["active", "running"].includes(status.toLowerCase()) ? "bg-emerald-400" : status === "ERROR" ? "bg-red-400" : status === "PAUSED" ? "bg-amber-400" : status === "TERMINATED" ? "bg-rose-400" : "bg-slate-400"}`}
      />
      {status}
    </span>
  );
}

function RegisteredToolsPanel({
  tools,
  loading = false,
  error = null,
}: {
  tools: ToolDefinition[];
  loading?: boolean;
  error?: string | null;
}) {
  const pagination = useTablePagination(tools);
  const getTierClasses = (tier: ToolDefinition["tier"]) => {
    if (tier === "Tier-1") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    }
    if (tier === "Tier-2") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    }
    return tier === "Tier-3" ? "border-violet-500/30 bg-violet-500/10 text-violet-200" : "border-slate-700 bg-slate-800 text-slate-300";
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/80">
        <header className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Registered tools
          </h2>
        </header>
        <div className="p-5 text-sm text-slate-400">Loading tools…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/80">
        <header className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Registered tools
          </h2>
        </header>
        <div className="p-5 text-sm text-rose-300">{error}</div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Registered tools
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Tools exposed by the control plane
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
          {tools.length} total
        </span>
      </header>

      <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/95 text-[11px] uppercase tracking-wide text-slate-400 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 text-center font-medium">Tool</th>
              <th className="px-4 py-3 text-center font-medium">ID</th>
              <th className="px-4 py-3 text-center font-medium">Tier</th>
              <th className="px-4 py-3 text-center font-medium">MCP server</th>
              <th className="px-4 py-3 text-center font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tools.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No tools registered.
                </td>
              </tr>
            ) : (
              pagination.visibleRows.map((tool) => (
                <tr
                  key={tool.id}
                  className="align-middle hover:bg-slate-800/40"
                >
                  <td className="border-t border-slate-800 px-4 py-3 align-middle">
                    <div className="whitespace-nowrap font-medium text-slate-100">
                      {tool.name}
                    </div>
                  </td>

                  <td className="border-t border-slate-800 px-4 py-3 align-middle font-mono text-[11px] text-slate-300">
                    <div className="whitespace-nowrap">{tool.tool_id}</div>
                  </td>

                  <td className="border-t border-slate-800 px-4 py-3 text-center align-middle">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getTierClasses(tool.tier)}`}
                    >
                      {tool.tier}
                    </span>
                  </td>

                  <td className="border-t border-slate-800 px-4 py-3 align-middle text-xs text-slate-300">
                    <div className="whitespace-nowrap">
                      {tool.mcp_server || "—"}
                    </div>
                  </td>

                  <td className="border-t border-slate-800 px-4 py-3 align-middle text-sm text-slate-300">
                    <div className="max-w-md leading-6">
                      {tool.description || "No description provided"}
                      <details className="mt-2 text-xs"><summary className="cursor-pointer text-blue-300">Parameters</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(tool.schema_json, null, 2)}</pre></details>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePagination {...pagination} label="Tool pagination" />
    </section>
  );
}

function AgentTable({
  rows,
  onSelect,
  selectedId,
}: {
  rows: Agent[];
  onSelect?: (agent: Agent) => void;
  selectedId?: string;
}) {
  const pagination = useTablePagination(rows);
  return (
    <div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            {["Agent", "Status", "Guardian", "Last activity"].map((label) => (
              <th key={label} className="pb-3 pr-4 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {pagination.visibleRows.map((agent) => (
            <tr
              key={agent.id}
              onClick={onSelect ? () => onSelect(agent) : undefined}
              onKeyDown={
                onSelect
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(agent);
                      }
                    }
                  : undefined
              }
              tabIndex={onSelect ? 0 : undefined}
              aria-selected={onSelect ? agent.id === selectedId : undefined}
              className={`group border-l-2 transition-colors ${
                agent.id === selectedId
                  ? "border-l-blue-400 bg-blue-500/10"
                  : "border-l-transparent hover:bg-slate-800/40"
              } ${
                onSelect
                  ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                  : ""
              }`}
            >
              <td className="py-3 pr-4">
                <span
                  className={`text-left font-medium ${
                    agent.id === selectedId ? "text-blue-200" : "text-slate-100"
                  }`}
                >
                  {agent.name}
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {agent.skill}
                  </span>
                </span>
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={agent.status} />
              </td>
              {/* <td className="py-3 pr-4 text-slate-300">{agent.tier}</td> */}
              <td className="py-3 pr-4 text-slate-300">{agent.guardian}</td>
              <td className="py-3 text-xs text-slate-400">{agent.activity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <TablePagination {...pagination} label="Agent pagination" />
    </div>
  );
}

export function OverviewPage() {
  const { last, status, subscribe } = useRealtime();
  const agentsSource = useApiResource<ControlPlaneAgent[]>("/agents/", []);
  const proposalsSource = useApiResource<Proposal[]>(
    "/proposals/",
    [],
  );
  const toolsSource = useApiResource<ToolDefinition[]>("/tools/", []);
  const auditSource = useApiResource<AuditLogEntry[]>("/audit/", []);
  const agents = agentsSource.data.map(toAgentView);
  const pendingProposals = proposalsSource.data.filter(
    (proposal) => proposal.status === "PENDING_HUMAN_APPROVAL",
  );
  const recentEvents = auditSource.data.slice(0, 5).map((event) => ({
    time: new Date(event.created_at).toLocaleString(),
    title: event.event_type.replaceAll("_", " "),
    detail: `${event.actor}${event.proposal_id ? ` · Proposal ${event.proposal_id}` : ""}`,
    color: event.event_type.includes("DENIED")
      ? "bg-red-400"
      : event.event_type.includes("APPROVAL")
        ? "bg-amber-400"
        : "bg-emerald-400",
  }));
  const reloadAgents = agentsSource.reload;
  const reloadProposals = proposalsSource.reload;
  const reloadTools = toolsSource.reload;
  const reloadAudit = auditSource.reload;
  const reloadAll = () => {
    reloadAgents();
    reloadProposals();
    reloadTools();
    reloadAudit();
  };
  const sources = [agentsSource, proposalsSource, toolsSource, auditSource];
  const loading = sources.some((resource) => resource.loading);
  const error = sources.find((resource) => resource.error)?.error ?? null;
  useEffect(
    () =>
      subscribe((event) => {
        if (
          [
            "agent.status_changed",
            "agent.updated",
            "approval.created",
            "approval.updated",
            "proposal.created",
            "proposal.updated",
            "audit.event.created",
          ].includes(event.type)
        ) {
          reloadAgents();
          reloadProposals();
          reloadTools();
          reloadAudit();
        }
      }),
    [reloadAgents, reloadAudit, reloadProposals, reloadTools, subscribe],
  );
  const lastEvent = last
    ? `${last.type} event received`
    : "Awaiting control-plane events";
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeading
        eyebrow="Human & governance layer"
        title="Guardian overview"
        description="A clear view of agent health, pending decisions, and governance signals across your control plane."
      >
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-amber-400"}`}
          />
          Realtime {status}
        </div>
      </PageHeading>
      <SourceNotice loading={loading} error={error} reload={reloadAll} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Agents online"
          value={`${agents.filter((agent) => ["active", "running"].includes(agent.status.toLowerCase())).length} / ${agents.length}`}
          change="Active agents / registered agents"
          icon={Bot}
          tone="green"
        />
        <Metric
          label="Pending proposals"
          value={String(pendingProposals.length)}
          change={
            pendingProposals.length
              ? "Awaiting human decision"
              : "No proposals awaiting review"
          }
          icon={Clock3}
          tone="amber"
        />
        <Metric
          label="Registered tools"
          value={String(toolsSource.data.length)}
          change="Tools exposed by the control plane"
          icon={ShieldCheck}
        />
        <Metric
          label="Recent audit events"
          value={String(auditSource.data.length)}
          change="Latest events returned by the audit API"
          icon={Activity}
          tone="blue"
        />
      </div>
      <RegisteredToolsPanel
        tools={toolsSource.data}
        loading={toolsSource.loading}
        error={toolsSource.error}
      />
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Panel
          title="Agent fleet"
          subtitle="Registered agent status and ownership"
          action={
            <span className="text-xs text-slate-500">
              {agents.length} registered
            </span>
          }
        >
          {agents.length ? (
            <AgentTable rows={agents} />
          ) : (
            <EmptyState
              title="No registered agents"
              body="The control plane returned no agents."
            />
          )}
        </Panel>
        <Panel
          title="Approval queue"
          subtitle="Proposals in PENDING_HUMAN_APPROVAL"
          action={
            <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
              {pendingProposals.length} pending
            </span>
          }
        >
          <div className="space-y-4">
            {pendingProposals.slice(0, 3).map((proposal) => (
              <div
                key={proposal.id}
                className="flex items-start gap-3 border-b border-slate-800 pb-4 last:border-0 last:pb-0"
              >
                <span className="mt-0.5 rounded-md bg-amber-400/10 p-2 text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {proposal.tool_id}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {new Date(proposal.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {proposal.agent_id} · {proposal.tier} · {proposal.id}
                  </p>
                </div>
              </div>
            ))}
            {pendingProposals.length === 0 && (
              <p className="text-sm text-slate-500">
                No proposals are awaiting human approval.
              </p>
            )}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Recent governance activity"
          subtitle="Latest audited changes and policy outcomes"
        >
          {recentEvents.length > 0 ? (
            <ol className="space-y-4">
              {recentEvents.map((event, index) => (
                <li key={`${event.time}:${index}`} className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${event.color}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-medium text-slate-200">
                        {event.title}
                      </p>
                      <time className="shrink-0 text-xs text-slate-500">
                        {event.time}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">
              No audit events returned by the API.
            </p>
          )}
        </Panel>
        <Panel
          title="Realtime event stream"
          subtitle="Live updates from the control plane"
        >
          <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <Activity className="mt-0.5 h-4 w-4 text-blue-300" />
            <div>
              <p className="text-sm font-medium text-slate-200">{lastEvent}</p>
              <p className="mt-1 text-xs text-slate-500">
                {last
                  ? "Most recently received event"
                  : "Status updates and approval requests will appear here as they arrive."}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            This frontend displays the event stream connection status; the
            pulled backend does not expose a WebSocket route.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export function AgentsPage() {
  const { subscribe } = useRealtime();
  const [selectedId, setSelectedId] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  // Search state
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<AgentStatus | null>(null);

  // Swap endpoint when a query is active
  const source = useApiResource<ControlPlaneAgent[] | ControlPlaneAgent>(
    "/agents/",
    [],
  );
  const { reload } = source;

  // Normalize single-object vs array response
  const agents = useMemo(() => {
    const raw = source.data;
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [raw]).filter((agent) => !activeQuery || agent.agent_id.includes(activeQuery)).map(toAgentView);
  }, [source.data, activeQuery]);

  const selected =
    agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;

  const toast = useToast();

  useEffect(
    () =>
      subscribe((event) => {
        if (
          event.type === "agent.status_changed" ||
          event.type === "agent.updated"
        )
          reload();
      }),
    [reload, subscribe],
  );

  const runSearch = () => {
    const query = search.trim();
    if (!query) {
      setSearch("");
      setActiveQuery("");
      setSearchError("");
      return;
    }
    setSearchError("");
    setActiveQuery(query);
  };

  const clearSearch = () => {
    setSearch("");
    setActiveQuery("");
    setSearchError("");
  };

  const updateAgentStatus = async (agent: Agent, nextStatus: AgentStatus) => {
    if (updatingAgentId) return;
    setUpdatingAgentId(agent.id);
    setUpdatingStatus(nextStatus);
    try {
      await GovernanceAPI.updateAgentStatus(agent.agent_id, nextStatus);
      await source.reload();
      toast.success(
        `${agent.name} status set to ${nextStatus}`,
        "Agent control",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update agent status.",
        "Control-plane request failed",
      );
    } finally {
      setUpdatingAgentId(null);
      setUpdatingStatus(null);
    }
  };
  const isUpdating = selected?.id === updatingAgentId;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeading
        eyebrow="Agent governance"
        title="Agent overview"
        description="Review each agent's status, risk tier, assigned guardian, configuration, and recent activity."
      >
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Register new Agent
        </button>
      </PageHeading>

      <SourceNotice
        loading={source.loading}
        error={activeQuery ? null : source.error}
        reload={source.reload}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.85fr]">
        <Panel
          title="Registered agents"
          subtitle="Select an agent to inspect its configuration and controls"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                    if (event.key === "Escape") clearSearch();
                  }}
                  placeholder="Search by agent ID…"
                  aria-label="Search agent by ID"
                  className="w-52 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={runSearch}
                disabled={!search.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </button>
            </div>
          }
        >
          {searchError ? (
            <div role="alert" className="px-4 py-3 text-sm text-rose-300">
              {searchError}
            </div>
          ) : activeQuery && source.error ? (
            <div role="alert" className="px-4 py-3 text-sm text-rose-300">
              {source.error.toLowerCase().includes("not found") ||
              source.error.startsWith("404")
                ? `Agent with ID "${activeQuery}" was not found.`
                : `Unable to search for agent "${activeQuery}": ${source.error}`}
            </div>
          ) : agents.length === 0 ? (
            <EmptyState
              title={activeQuery ? "No agent found" : "No agents registered"}
              body={
                activeQuery
                  ? `No agent matches ID "${activeQuery}".`
                  : "Register a new agent to get started."
              }
            />
          ) : (
            <AgentTable
              rows={agents}
              onSelect={(agent) => setSelectedId(agent.id)}
              selectedId={selected.id}
            />
          )}
        </Panel>

        {selected ? (
          <Panel
            title="Agent details"
            subtitle="Identity, runtime configuration, and status controls"
            action={<StatusBadge status={selected.status} />}
          >
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-lg font-semibold text-white">
                {selected.name}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                {selected.agent_id}
              </p>
              <p className="mt-3 text-sm leading-5 text-slate-400">
                {selected.description ||
                  "No agent description has been provided."}
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Detail label="Version" value={selected.version} />
              <Detail
                label="Owner / guardian"
                value={selected.owner ?? "Unassigned"}
              />
              <Detail label="Runtime status" value={selected.status} />
              <Detail label="Primary model" value={selected.model_primary} />
              <Detail
                label="Fallback model"
                value={selected.model_fallback ?? "Not configured"}
              />
              <Detail
                label="Created"
                value={
                  selected.created_at
                    ? selected.created_at === "Not supplied" ? "Not supplied" : new Date(selected.created_at).toLocaleString()
                    : "—"
                }
              />
              <Detail
                label="Last updated"
                value={
                  selected.updated_at
                    ? new Date(selected.updated_at).toLocaleString()
                    : "Not provided"
                }
              />
              {/* <Detail label="Tier" value={selected.tier} /> */}
            </dl>

            <AgentStatusControls
              key={`${selected.id}:${selected.status}`}
              agent={selected}
              busy={isUpdating}
              updatingStatus={isUpdating ? updatingStatus : null}
              onUpdate={(status) => void updateAgentStatus(selected, status)}
            />
          </Panel>
        ) : (
          <Panel title="Agent detail" subtitle="No agent selected">
            <EmptyState
              title="Nothing to show"
              body="Search for an agent by ID, or clear the search to see the full list."
            />
          </Panel>
        )}
      </div>

      <RegisterAgentModal
        key={registerOpen ? "open" : "closed"}
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={reload}
      />
    </div>
  );
}

function AgentStatusControls({ agent, busy, updatingStatus, onUpdate }: {
  agent: Agent; busy: boolean; updatingStatus: AgentStatus | null; onUpdate: (status: AgentStatus) => void;
}) {
  const [nextStatus, setNextStatus] = useState(agent.status);
  return <form className="mt-4 space-y-3 border-t border-slate-800 pt-4" onSubmit={(event) => {
    event.preventDefault(); if (nextStatus.trim() && !busy) onUpdate(nextStatus.trim());
  }}>
    <label className="block text-sm text-slate-300">Agent status
      <input value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={busy}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" />
    </label>
    <button disabled={busy || !nextStatus.trim() || nextStatus === agent.status} className="rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">
      {updatingStatus ? "Updating…" : "Update status"}
    </button>
  </form>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-xs font-medium leading-5 text-slate-200">
        {value}
      </dd>
    </div>
  );
}

export function PolicyPage() {
  const source = useApiResource<PolicyConfiguration[]>("/policies/", []);
  return <div className="mx-auto max-w-[1200px] space-y-6">
    <PageHeading eyebrow="Governance controls" title="Policy manager" description="Read-only policies and rules returned by the control plane." />
    <SourceNotice loading={source.loading} error={source.error} reload={source.reload} />
    {!source.loading && !source.error && !source.data.length && <Panel title="Policies"><p>No policies returned.</p></Panel>}
    {source.data.map((policy) => <Panel key={policy.policy_id} title={policy.policy_id} subtitle={`${policy.rules.length} rules`}>
      {policy.mode && <p className={`mb-4 text-sm ${policy.mode === "enforce" ? "text-emerald-300" : "text-amber-300"}`}>Policy mode: {policy.mode.replaceAll("_", " ")}</p>}
      {policy.rules.length ? policy.rules.map((rule, index) => <pre key={index} className="mb-3 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{JSON.stringify(rule, null, 2)}</pre>) : <p className="text-sm text-slate-400">No rules returned for this policy.</p>}
    </Panel>)}
  </div>;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500";

const DEFAULT_REGISTER_FORM = { name: "", type: "", config: "{}" };

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-300">
        {label} {required && <span className="text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}

function RegisterAgentModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [form, setForm] = useState(DEFAULT_REGISTER_FORM);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!open) return null;

  const update =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));

  let config: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(form.config);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) config = parsed as Record<string, unknown>;
  } catch { /* Invalid JSON keeps submission disabled. */ }
  const valid = !!form.name.trim() && !!form.type.trim() && config !== null;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const registered = await GovernanceAPI.registerAgent({ name: form.name.trim(), type: form.type.trim(), config: config! });
      toast.success(`${form.name}: ${registered.status} (${registered.agent_id})`, "Agent registration");
      onRegistered();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to register agent.",
        "Registration failed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-agent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex justify-between gap-3">
          <div>
            <h2
              id="register-agent-title"
              className="text-lg font-semibold text-white"
            >
              Register new agent
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Enter the agent name, type, and JSON configuration. The API assigns its ID.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close registration dialog"
            className="h-fit rounded-md p-1 text-slate-400 hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name" required><input value={form.name} onChange={update("name")} className={inputClass} /></Field>
          <Field label="Type" required><input value={form.type} onChange={update("type")} className={inputClass} /></Field>
          <Field label="Configuration (JSON object)" required className="sm:col-span-2">
            <textarea value={form.config} onChange={update("config")} rows={7} className={`${inputClass} font-mono`} />
            {config === null && <span role="alert" className="text-xs text-rose-300">Enter a valid JSON object.</span>}
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {busy ? "Registering…" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );
}
