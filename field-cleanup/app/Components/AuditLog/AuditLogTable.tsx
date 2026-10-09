"use client";

import { ArrowUp, ArrowDown, Lock, AlertTriangle } from "lucide-react";
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
              <Th width="24%">Action Type</Th>
              <Th width="10%">Details</Th>
              <Th width="12%">Risk Tier</Th>
              <Th width="16%">HMAC Status</Th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => (
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
        {logs.map((log) => (
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
  status: "Present" | "Missing";
  signature?: string;
}) {
  const present = status === "Present";
  return (
    <span
      title={signature ?? "The backend returned no HMAC signature"}
      className={[
        "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-medium leading-tight text-white",
        present ? "bg-[#429861]" : "bg-[#b54848]",
      ].join(" ")}
    >
      {present ? (
        <Lock className="h-3 w-3 shrink-0" />
      ) : (
        <AlertTriangle className="h-3 w-3 shrink-0" />
      )}
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
        {present ? `Signature present · ${signature?.slice(0, 16)}…` : "Signature missing"}
      </span>
    </span>
  );
}