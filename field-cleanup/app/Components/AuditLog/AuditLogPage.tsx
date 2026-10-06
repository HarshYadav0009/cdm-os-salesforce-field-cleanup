"use client";

import { useEffect, useMemo, useState } from "react";
import AuditHeadSection from "./AuditHeadSection";
import { useToast } from "@/app/Components/Toast/useToast";
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
  const source = useApiResource<AuditLogEntry[]>("/audit/?limit=100", []);
  const { reload } = source;
  const { subscribe } = useRealtime();
  const logs = useMemo(() => source.data.map(toAuditLog), [source.data]);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const toast = useToast();

  useEffect(
    () => subscribe((event) => {
      if (event.type === "audit.event.created") reload();
    }),
    [reload, subscribe],
  );

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = logs.filter((l) => {
      const matchesSearch =
        !q ||
        l.actor.toLowerCase().includes(q) ||
        l.actionType.toLowerCase().includes(q) ||
        l.workflowId.toLowerCase().includes(q);
      const matchesAgent =
        !agentFilter || l.actor.toLowerCase() === agentFilter.toLowerCase();
      return matchesSearch && matchesAgent;
    });
    return sortAsc ? [...rows].reverse() : rows;
  }, [logs, search, agentFilter, sortAsc]);

  const handleViewDetails = (log: AuditLog) => {
    toast.info(
      `Event ${log.id}${log.hmacSignature ? ` · HMAC ${log.hmacSignature}` : " · No HMAC signature returned"}`,
      "Audit event details",
    );
  };

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
          onDateRangeChange={setDateRange}
          agentFilter={agentFilter}
          onAgentFilterChange={setAgentFilter}
          logs={filteredLogs}
          sortAsc={sortAsc}
          onToggleSort={() => setSortAsc((v) => !v)}
          onViewDetails={handleViewDetails}
          infoCards={infoCards}
        />
      </div>
    </div>
  );
}
