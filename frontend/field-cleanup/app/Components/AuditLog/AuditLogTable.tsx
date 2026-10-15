"use client";
import TablePagination, { useTablePagination } from "@/app/Components/shared/TablePagination";

import { useState } from "react";
import { ArrowUp, ArrowDown, Lock, AlertTriangle, Copy, Check, ShieldQuestion } from "lucide-react";
import type { AuditLog } from "./types";

interface AuditLogTableProps {
  logs: AuditLog[];
  sortAsc: boolean;
  onToggleSort: () => void;
  onViewDetails: (log: AuditLog) => void;
}

export default function AuditLogTable({
  logs,
  sortAsc,
  onToggleSort,
  onViewDetails,
}: AuditLogTableProps) {
  const pagination = useTablePagination(logs);
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800/60 px-4 py-12 text-center text-sm text-slate-400">
        No audit events match your filters.
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-800/60 font-sans text-slate-300">
      {/* ───── Desktop / tablet: table ───── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
          <thead className="bg-slate-700">
            <tr>
              <Th width="14%" onClick={onToggleSort}>
                <span className="flex items-center gap-1 hover:text-white">
                  Timestamp
                  {sortAsc ? (
                    <ArrowUp className="h-3 w-3 shrink-0 text-slate-400" />
                  ) : (
                    <ArrowDown className="h-3 w-3 shrink-0 text-slate-400" />
                  )}
                </span>
              </Th>
              <Th width="12%">Workflow ID</Th>
              <Th width="12%">Actor</Th>
              <Th width="22%">Action Type</Th>
              <Th width="10%">Details</Th>
              <Th width="12%">Risk Tier</Th>
              <Th width="18%">HMAC Status</Th>
            </tr>
          </thead>

          <tbody>
            {pagination.visibleRows.map((log) => (
              <tr
                key={log.id}
                className={[
                  "border-b border-slate-700/60 transition-colors last:border-b-0",
                  log.isAlert ? "bg-[#382225]" : "hover:bg-slate-800/30",
                ].join(" ")}
              >
                <Cell className="break-words [overflow-wrap:anywhere]">
                  {log.timestamp}
                </Cell>
                <Cell break>
                  <span title={log.workflowId}>
                    {log.workflowId.slice(0, 10)}
                  </span>
                </Cell>
                <Cell break>{log.actor}</Cell>
                <Cell className="whitespace-pre-wrap leading-snug break-words">
                  {log.actionType}
                </Cell>
                <Cell>
                  <button
                    type="button"
                    onClick={() => onViewDetails(log)}
                    className="inline-block text-[11px] font-sans text-blue-400 hover:underline"
                  >
                    View Details
                  </button>
                </Cell>
                <Cell>
                  <RiskBadge tier={log.riskTier} />
                </Cell>
                <Cell>
                  <HmacBadge
                    status={log.hmacStatus}
                    signature={log.hmacSignature}
                  />
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ───── Mobile: card list ───── */}
      <ul className="divide-y divide-slate-700/60 md:hidden">
        {pagination.visibleRows.map((log) => (
          <li
            key={log.id}
            className={[
              "space-y-3 p-4",
              log.isAlert ? "bg-[#382225]" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Timestamp
                </p>
                <p className="text-xs text-slate-200">{log.timestamp}</p>
              </div>
              <div className="max-w-[45%] shrink-0">
                <RiskBadge tier={log.riskTier} />
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 text-[11px]">
              <Field
                label="Workflow ID"
                value={log.workflowId.slice(0, 10)}
                title={log.workflowId}
              />
              <Field label="Actor" value={log.actor} />
              <div className="col-span-2">
                <p className="text-slate-400">Action</p>
                <p className="whitespace-pre-wrap break-words text-slate-200">
                  {log.actionType}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => onViewDetails(log)}
                className="text-[11px] text-blue-400 hover:underline"
              >
                View Details
              </button>
              <HmacBadge status={log.hmacStatus} signature={log.hmacSignature} />
            </div>
          </li>
        ))}
      </ul>
      <TablePagination {...pagination} />
    </div>
  );
}

/* ─────────── Small reusable pieces ─────────── */

function Th({
  children,
  width,
  onClick,
}: {
  children: React.ReactNode;
  width: string;
  onClick?: () => void;
}) {
  return (
    <th
      style={{ width }}
      onClick={onClick}
      className={[
        "border-b border-slate-700/60 px-2 py-2 text-[11px] font-medium leading-tight text-slate-200",
        onClick ? "cursor-pointer select-none" : "",
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
  className = "",
  break: shouldBreak = false,
}: {
  children: React.ReactNode;
  className?: string;
  break?: boolean;
}) {
  return (
    <td
      className={[
        "align-top px-2 py-3 text-[11px] text-slate-300",
        "min-w-0 [overflow-wrap:anywhere]",
        shouldBreak ? "break-words" : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function Field({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-slate-400">{label}</p>
      <p title={title} className="break-all text-slate-200">
        {value}
      </p>
    </div>
  );
}

function RiskBadge({ tier }: { tier: string }) {
  const isAuto = tier.includes("Tier 1");
  return (
    <span
      className={[
        "inline-block max-w-full break-words rounded-full px-2 py-1 text-center text-[10px] font-medium leading-tight text-white [overflow-wrap:anywhere]",
        isAuto ? "bg-[#4b9b6f]" : "bg-[#a46c3f]",
      ].join(" ")}
    >
      {tier}
    </span>
  );
}

function HmacBadge({
  status,
  signature,
}: {
  status: AuditLog["hmacStatus"];
  signature?: string;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const appearance = {
    Verified: { label: "Verified", icon: Lock, color: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400", hint: "Event payload signature verified" },
    Present: { label: "Unverified", icon: ShieldQuestion, color: "border-amber-500/25 bg-amber-500/10 text-amber-400", hint: "Signature present; verification has not been performed" },
    Invalid: { label: "Invalid", icon: AlertTriangle, color: "border-red-500/25 bg-red-500/10 text-red-400", hint: "Event payload signature failed verification" },
    "Not found": { label: "Not found", icon: AlertTriangle, color: "border-slate-500/25 bg-slate-500/10 text-slate-400", hint: "Audit record was not found during verification" },
    Missing: { label: "Not supplied", icon: ShieldQuestion, color: "border-slate-500/25 bg-slate-500/10 text-slate-400", hint: "This API response does not supply an HMAC signature" },
  }[status];
  const Icon = appearance.icon;

  async function copySignature() {
    if (!signature) return;
    try {
      await navigator.clipboard.writeText(signature);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col items-start gap-1.5">
      <span
        title={appearance.hint}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-medium leading-none ${appearance.color}`}
      >
        <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
        {appearance.label}
      </span>
      {signature && (
        <div className="flex max-w-full items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/40 pl-1.5">
          <code title={signature} className="min-w-0 truncate text-[10px] leading-5 tracking-tight text-slate-400">
            {signature.slice(0, 16)}{signature.length > 16 ? "…" : ""}
          </code>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); void copySignature(); }}
            aria-label="Copy full HMAC SHA-256 signature"
            title={copyStatus === "copied" ? "Signature copied" : "Copy full signature"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-r-md border-l border-slate-700/60 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            {copyStatus === "copied" ? <Check aria-hidden="true" className="h-3 w-3 text-emerald-400" /> : <Copy aria-hidden="true" className="h-3 w-3" />}
          </button>
        </div>
      )}
      <span role="status" className={copyStatus === "failed" ? "max-w-[180px] text-[10px] leading-snug text-red-400" : "sr-only"}>
        {copyStatus === "copied" ? "Signature copied" : copyStatus === "failed" ? "Copy failed. Copy the signature from event details." : ""}
      </span>
    </div>
  );
}
