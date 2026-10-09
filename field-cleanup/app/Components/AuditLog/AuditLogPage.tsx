"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import AuditHeadSection from "./AuditHeadSection";
import type { AuditInfoCard, AuditLog } from "./types";
import { useApiResource } from "@/app/lib/api/useApiResource";
import type { AuditLogEntry } from "@/types/governance";
import { SourceNotice } from "@/app/Components/Governance/GovernancePages";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";

function toAuditLog(entry: AuditLogEntry): AuditLog {
  const signature = entry.hmac_signature ?? undefined;
  return {
    id: entry.id,
    timestamp: new Date(entry.created_at).toLocaleString(),
    createdAt: entry.created_at,
    workflowId: entry.proposal_id ?? entry.id,
    actor: entry.actor,
    actionType: entry.event_type,
    resource: entry.proposal_id,
    detailsText: JSON.stringify(entry.payload, null, 2),
    riskTier:
      typeof entry.payload.tier === "string"
        ? entry.payload.tier
        : "Not supplied",
    hmacStatus: signature ? "Present" : "Missing",
    hmacSignature: signature,
    isAlert: entry.event_type.includes("FAILED") || entry.event_type.includes("DENIED"),
  };
}

export default function AuditLogPage() {
  const source = useApiResource<AuditLogEntry[]>("/audit/?limit=500", []);
  const { reload } = source;
  const { subscribe } = useRealtime();
  const logs = useMemo(() => source.data.map(toAuditLog), [source.data]);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(
    () => subscribe((event) => {
      if (event.type === "audit.event.created") reload();
    }),
    [reload, subscribe],
  );

  useEffect(() => {
    if (!selectedLog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedLog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedLog]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const agentOrAction = agentFilter.trim().toLowerCase();
    const rangeInMs: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff =
      dateRange === "today" && currentTime > 0
        ? new Date(currentTime).setHours(0, 0, 0, 0)
        : rangeInMs[dateRange] !== undefined && currentTime > 0
          ? currentTime - rangeInMs[dateRange]
          : null;
    const rows = logs.filter((l) => {
      const matchesSearch =
        !q ||
        l.actor.toLowerCase().includes(q) ||
        l.actionType.toLowerCase().includes(q) ||
        l.workflowId.toLowerCase().includes(q) ||
        (l.resource?.toLowerCase().includes(q) ?? false) ||
        (l.detailsText?.toLowerCase().includes(q) ?? false);
      const matchesAgentOrAction =
        !agentOrAction ||
        l.actor.toLowerCase().includes(agentOrAction) ||
        l.actionType.toLowerCase().includes(agentOrAction);
      const createdAt = new Date(l.createdAt).getTime();
      const matchesDate = cutoff === null || createdAt >= cutoff;
      return matchesSearch && matchesAgentOrAction && matchesDate;
    });
    return sortAsc ? [...rows].reverse() : rows;
  }, [logs, search, agentFilter, dateRange, sortAsc, currentTime]);

  const infoCards = useMemo<AuditInfoCard[]>(() => [
    {
      id: "signed",
      title: "Events with HMAC",
      label: "Returned by API:",
      value: String(source.data.filter((entry) => Boolean(entry.hmac_signature)).length),
    },
    {
      id: "unsigned",
      title: "Events without HMAC",
      label: "Returned by API:",
      value: String(source.data.filter((entry) => !entry.hmac_signature).length),
    },
  ], [source.data]);

  return (
    <div className="space-y-2">
      <h1 className="p-1 text-xl font-bold sm:text-2xl">Audit Log</h1>

      <div className="rounded-lg border border-slate-700 bg-slate-900">
        <SourceNotice loading={source.loading} error={source.error} reload={source.reload} />
        <AuditHeadSection
          search={search}
          onSearchChange={setSearch}
          dateRange={dateRange}
          onDateRangeChange={(value) => {
            setDateRange(value);
            setCurrentTime(Date.now());
          }}
          agentFilter={agentFilter}
          onAgentFilterChange={setAgentFilter}
          logs={filteredLogs}
          sortAsc={sortAsc}
          onToggleSort={() => setSortAsc((v) => !v)}
          onViewDetails={setSelectedLog}
          infoCards={infoCards}
        />
      </div>

      {selectedLog && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedLog(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-event-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4">
              <div>
                <h2
                  id="audit-event-details-title"
                  className="text-lg font-semibold text-white"
                >
                  Audit event details
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-400">
                  {selectedLog.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close audit event details"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                <AuditDetail label="Timestamp" value={selectedLog.timestamp} />
                <AuditDetail label="Event type" value={selectedLog.actionType} />
                <AuditDetail label="Actor" value={selectedLog.actor} />
                <AuditDetail label="Workflow / proposal" value={selectedLog.workflowId} />
                <AuditDetail label="Resource" value={selectedLog.resource ?? "Not supplied"} />
                <AuditDetail label="Risk tier" value={selectedLog.riskTier} />
                <AuditDetail label="HMAC status" value={selectedLog.hmacStatus} />
              </dl>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Event payload
                </h3>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">
                  {selectedLog.detailsText ?? "No payload returned."}
                </pre>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  HMAC signature
                </h3>
                <p className="break-all rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">
                  {selectedLog.hmacSignature ?? "No HMAC signature returned."}
                </p>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AuditDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-all text-xs leading-5 text-slate-200">{value}</dd>
    </div>
  );
}
