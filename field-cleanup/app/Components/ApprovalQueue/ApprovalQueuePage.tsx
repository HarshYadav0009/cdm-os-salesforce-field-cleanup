"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, RefreshCw, Search, ShieldCheck } from "lucide-react";
import QueueTable, { type QueueRow } from "./QueueTable";
import RiskAssessmentModal from "./RiskAssessmentModal";
import { useToast } from "../Toast/useToast";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { GovernanceAPI } from "@/app/lib/api/governance";
import { SourceNotice } from "@/app/Components/Governance/GovernancePages";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";
import type { Proposal } from "@/types/governance";

const DELETION_POLL_INTERVAL_MS = 500;
const DELETION_POLL_ATTEMPTS = 90;

function getPayloadValue(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function formatQueueTime(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return createdAt;

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function toQueueRow(proposal: Proposal): QueueRow {
  return {
    id: proposal.id,
    targetField:
      getPayloadValue(proposal.input_payload, [
        "field_api_name",
        "field_name",
        "target_field",
        "field",
      ]) ?? "—",
    targetName:
      getPayloadValue(proposal.input_payload, [
        "object",
        "object_name",
        "sobject",
        "target",
      ]) ?? proposal.tool_id,
    action: proposal.tool_id,
    risk: `${proposal.tier} · Human approval`,
    queueTime: formatQueueTime(proposal.created_at),
    proposal,
  };
}

export default function ApprovalQueuePage() {
  const source = useApiResource<Proposal[]>("/proposals/queue/pending", []);
  const { reload } = source;
  const { subscribe } = useRealtime();
  const rows = source.data.map(toQueueRow);
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null);
  const [initialDecision, setInitialDecision] = useState<"approve" | "reject" | undefined>();
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const toast = useToast();
  const tierThreeCount = rows.filter((row) => row.proposal.tier === "Tier-3").length;
  const tierTwoCount = rows.filter((row) => row.proposal.tier === "Tier-2").length;
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTier =
        tierFilter === "all" || row.proposal.tier === tierFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          row.targetName,
          row.targetField,
          row.action,
          row.id,
          row.proposal.agent_id,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesTier && matchesQuery;
    });
  }, [query, rows, tierFilter]);

  useEffect(
    () => subscribe((event) => {
      if (
        ["approval.created", "approval.updated", "proposal.created", "proposal.updated"].includes(
          event.type,
        )
      ) {
        reload();
      }
    }),
    [reload, subscribe],
  );

  const handleDecision = async (
    row: QueueRow,
    decision: "approve" | "reject",
    reviewerEmail: string,
    reason: string,
  ) => {
    try {
      await GovernanceAPI.submitDecision(
        row.id,
        decision === "approve" ? "APPROVED" : "REJECTED",
        reviewerEmail,
        reason,
      );
      source.setData((prev) => prev.filter((proposal) => proposal.id !== row.id));
      setSelectedRow(null);
      if (decision === "approve") {
        try {
          await GovernanceAPI.executeProposal(row.id);
          if (row.proposal.tool_id === "salesforce_delete_field") {
            let completed = false;
            for (let attempt = 0; attempt < DELETION_POLL_ATTEMPTS; attempt += 1) {
              await new Promise((resolve) =>
                window.setTimeout(resolve, DELETION_POLL_INTERVAL_MS),
              );
              const current = await GovernanceAPI.getProposal(row.id);
              if (current.status === "COMPLETED") {
                const objectName = getPayloadValue(current.input_payload, [
                  "object_name",
                  "object_api_name",
                  "object",
                  "sobject",
                ]);
                const fieldName = getPayloadValue(current.input_payload, [
                  "field_api_name",
                  "field_name",
                  "target_field",
                  "field",
                ]);
                if (objectName && fieldName) {
                  window.dispatchEvent(
                    new CustomEvent("salesforce-field-deleted", {
                      detail: { objectName, fieldName },
                    }),
                  );
                }
                toast.success(
                  `Deleted ${objectName ?? row.targetName}.${fieldName ?? row.action}. Dependency Viewer refreshed.`,
                );
                completed = true;
                break;
              }
              if (current.status === "FAILED") {
                throw new Error(
                  current.error_message || "Salesforce field deletion failed.",
                );
              }
              if (current.status !== "EXECUTING") {
                throw new Error(
                  `Deletion entered an unexpected state (${current.status}).`,
                );
              }
            }
            if (!completed) {
              toast.info(
                `Deletion is still running. The Dependency Viewer will refresh when the field deletion completes.`,
                "Deletion in progress",
              );
            }
            return;
          }
        } catch (error) {
          toast.error(
            `Proposal was approved, but execution did not complete: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            "Execution issue",
          );
          return;
        }
        toast.success(`Approved and dispatched ${row.targetName}:${row.action}`);
      } else {
        toast.success(`Rejected ${row.targetName}:${row.action}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the approval decision.", "Decision not recorded");
    }
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/60 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <ShieldCheck className="h-4 w-4" />
              Governance · Human review
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Approval queue
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Review policy-routed proposals, inspect their risk evidence, and
              record an audited decision.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[390px]">
            <QueueMetric
              label="Awaiting review"
              value={rows.length}
              icon={Clock3}
              tone="blue"
            />
            <QueueMetric
              label="Tier 3"
              value={tierThreeCount}
              icon={AlertTriangle}
              tone="rose"
            />
            <QueueMetric
              label="Tier 2"
              value={tierTwoCount}
              icon={ShieldCheck}
              tone="amber"
            />
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Pending proposals
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {filteredRows.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? "proposal" : "proposals"} need a decision`
                : `Showing ${filteredRows.length} of ${rows.length} proposals`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search field, action, agent…"
                aria-label="Search pending proposals"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </label>
            <select
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value)}
              aria-label="Filter proposals by risk tier"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All tiers</option>
              <option value="Tier-2">Tier 2</option>
              <option value="Tier-3">Tier 3</option>
            </select>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={source.loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${source.loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        <QueueTable
          rows={filteredRows}
          loading={source.loading}
          emptyTitle={
            rows.length === 0 ? "Queue is clear" : "No matching proposals"
          }
          emptyMessage={
            rows.length === 0
              ? "There are no proposals waiting for review."
              : "No proposals match these filters. Try another search or tier."
          }
          onViewEvidence={(row) => {
            setInitialDecision(undefined);
            setSelectedRow(row);
          }}
          onApprove={(row) => {
            setInitialDecision("approve");
            setSelectedRow(row);
          }}
          onReject={(row) => {
            setInitialDecision("reject");
            setSelectedRow(row);
          }}
        />
      </section>
      <SourceNotice loading={source.loading} error={source.error} reload={source.reload} />

      <RiskAssessmentModal
        key={selectedRow ? `${selectedRow.id}:${initialDecision ?? "evidence"}` : "closed"}
        isOpen={selectedRow !== null}
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        initialDecision={initialDecision}
        onApprove={(row, reviewerEmail, reason) =>
          handleDecision(row, "approve", reviewerEmail, reason)
        }
        onReject={(row, reviewerEmail, reason) =>
          handleDecision(row, "reject", reviewerEmail, reason)
        }
      />
    </div>
  );
}

function QueueMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
  tone: "blue" | "rose" | "amber";
}) {
  const tones = {
    blue: "bg-blue-400/10 text-blue-300",
    rose: "bg-rose-400/10 text-rose-300",
    amber: "bg-amber-400/10 text-amber-300",
  };

  return (
    <div className="min-w-0 rounded-xl border border-white/5 bg-slate-950/50 p-3 sm:p-4">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xl font-semibold leading-none text-white sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] text-slate-400 sm:text-xs">
        {label}
      </p>
    </div>
  );
}
