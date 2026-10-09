"use client";

import { ArrowUpRight, Check, FileSearch, LoaderCircle, X } from "lucide-react";
import type { Proposal } from "@/types/governance";

export interface QueueRow {
  id: string;
  targetField: string;
  targetName: string;
  action: string;
  risk: string;
  queueTime: string;
  proposal: Proposal;
}

interface QueueTableProps {
  rows: QueueRow[];
  loading: boolean;
  emptyTitle: string;
  emptyMessage: string;
  onViewEvidence: (row: QueueRow) => void;
  onApprove: (row: QueueRow) => void;
  onReject: (row: QueueRow) => void;
}

export default function QueueTable({
  rows,
  loading,
  emptyTitle,
  emptyMessage,
  onViewEvidence,
  onApprove,
  onReject,
}: QueueTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
        <div className={`mb-4 rounded-2xl border p-3 ${loading ? "border-blue-400/15 bg-blue-400/10 text-blue-300" : "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"}`}>
          {loading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
        </div>
        <h3 className="text-sm font-semibold text-slate-100">
          {loading ? "Loading approvals" : emptyTitle}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {loading ? "Fetching pending proposals from the control plane…" : emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="w-[24%] px-5 py-3 font-semibold">Target</th>
              <th className="w-[18%] px-4 py-3 font-semibold">Proposed action</th>
              <th className="w-[13%] px-4 py-3 font-semibold">Risk tier</th>
              <th className="w-[12%] px-4 py-3 font-semibold">Submitted</th>
              <th className="w-[13%] px-4 py-3 font-semibold">Evidence</th>
              <th className="w-[20%] px-5 py-3 text-right font-semibold">
                Decision
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="align-middle transition-colors hover:bg-slate-800/30"
              >
                <td className="px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100" title={row.targetName}>
                      {row.targetName}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500" title={row.targetField}>
                      {row.targetField}
                    </p>
                    <p className="mt-1 truncate text-[10px] text-slate-600" title={row.id}>
                      ID · {row.id}
                    </p>
                  </div>
                </td>
                <td className="break-words px-4 py-4 text-slate-300">{row.action}</td>
                <td className="px-4 py-4">
                  <RiskBadge tier={row.proposal.tier} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-400">
                  {row.queueTime}
                </td>
                <td className="px-4 py-4">
                  <EvidenceButton onClick={() => onViewEvidence(row)} />
                </td>
                <td className="px-5 py-4">
                  <DecisionControls
                    onApprove={() => onApprove(row)}
                    onReject={() => onReject(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-800 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{row.targetName}</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-500">{row.targetField}</p>
              </div>
              <RiskBadge tier={row.proposal.tier} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <MobileField label="Action" value={row.action} />
              <MobileField label="Submitted" value={row.queueTime} />
              <MobileField label="Proposal ID" value={row.id} />
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Risk packet
                </p>
                <EvidenceButton onClick={() => onViewEvidence(row)} />
              </div>
            </div>
            <DecisionControls
              full
              onApprove={() => onApprove(row)}
              onReject={() => onReject(row)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="truncate text-xs text-slate-300" title={value}>
        {value}
      </p>
    </div>
  );
}

function RiskBadge({ tier }: { tier: Proposal["tier"] }) {
  const styles: Record<Proposal["tier"], string> = {
    "Tier-1": "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    "Tier-2": "border-amber-400/20 bg-amber-400/10 text-amber-300",
    "Tier-3": "border-rose-400/20 bg-rose-400/10 text-rose-300",
  };

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tier]}`}>
      {tier.replace("-", " ")}
    </span>
  );
}

function EvidenceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 transition-colors hover:text-blue-200"
    >
      <FileSearch className="h-4 w-4" />
      Risk packet
      <ArrowUpRight className="h-3 w-3" />
    </button>
  );
}

function DecisionControls({
  onApprove,
  onReject,
  full = false,
}: {
  onApprove: () => void;
  onReject: () => void;
  full?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${full ? "w-full [&>button]:flex-1" : "justify-end"}`}>
      <button
        type="button"
        onClick={onReject}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200"
      >
        <X className="h-3.5 w-3.5" />
        Reject
      </button>
      <button
        type="button"
        onClick={onApprove}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
      >
        <Check className="h-3.5 w-3.5" />
        Approve
      </button>
    </div>
  );
}
