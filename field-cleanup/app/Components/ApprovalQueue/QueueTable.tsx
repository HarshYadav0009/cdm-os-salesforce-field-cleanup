"use client";

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
  onViewEvidence: (row: QueueRow) => void;
  onApprove: (row: QueueRow) => void;
  onReject: (row: QueueRow) => void;
}

export default function QueueTable({
  rows,
  onViewEvidence,
  onApprove,
  onReject,
}: QueueTableProps) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-slate-700 px-4 py-12 text-center text-sm text-slate-400">
        No pending approvals. 🎉
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 text-slate-200">
      {/* ───────── Desktop / tablet: table ───────── */}
      <div className="hidden md:block max-h-[33rem] overflow-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {[
                ["Target Field (SObject.API Name)", "18%"],
                ["Target Field", "12%"],
                ["Proposed Action", "16%"],
                ["Risk Tier", "14%"],
                ["Queue Time", "10%"],
                ["Evidence", "14%"],
                ["Inline Controls", "16%"],
              ].map(([label, width]) => (
                <th
                  key={label}
                  style={{ width }}
                  className="border-b border-slate-600 bg-slate-700 px-3 py-3 text-left font-semibold"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-800 align-top transition-colors last:border-0 hover:bg-slate-800/40"
              >
                <td className="break-words px-3 py-3">{row.targetField}</td>
                <td className="break-words px-3 py-3">{row.targetName}</td>
                <td className="break-words px-3 py-3">{row.action}</td>
                <td className="px-3 py-3">
                  <RiskBadge risk={row.risk} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {row.queueTime}
                </td>
                <td className="px-3 py-3">
                  <EvidenceButton onClick={() => onViewEvidence(row)} />
                </td>
                <td className="px-3 py-3">
                  <InlineControls
                    onApprove={() => onApprove(row)}
                    onReject={() => onReject(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ───────── Mobile: card list ───────── */}
      <ul className="divide-y divide-slate-800 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Target
                </p>
                <p className="truncate text-sm font-medium">
                  {row.targetName}
                </p>
              </div>
              <RiskBadge risk={row.risk} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Field" value={row.targetField} />
              <Field label="Action" value={row.action} />
              <Field label="Queue Time" value={row.queueTime} />
              <div>
                <p className="text-slate-400">Evidence</p>
                <EvidenceButton onClick={() => onViewEvidence(row)} />
              </div>
            </div>

            <InlineControls
              onApprove={() => onApprove(row)}
              onReject={() => onReject(row)}
              full
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Small reusable pieces ───────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="truncate">{value}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-orange-600 px-2 py-1 text-xs font-medium text-white">
      {risk}
    </span>
  );
}

function EvidenceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer text-blue-400 hover:text-blue-300 hover:underline"
    >
      View Risk Packet
    </button>
  );
}

function InlineControls({
  onApprove,
  onReject,
  full = false,
}: {
  onApprove: () => void;
  onReject: () => void;
  full?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        full ? "w-full [&>button]:flex-1" : ""
      }`}
    >
      <button
        onClick={onApprove}
        className="cursor-pointer rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-500"
      >
        Approve
      </button>
      <button
        onClick={onReject}
        className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500"
      >
        Reject
      </button>
    </div>
  );
}