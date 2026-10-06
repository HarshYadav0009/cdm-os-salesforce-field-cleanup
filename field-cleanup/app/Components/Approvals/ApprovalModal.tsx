// src/components/approvals/ApprovalModal.tsx
"use client";
import { useState } from "react";
import type { Approval } from "@/types/approval";

interface Props {
  approval: Approval;
  mode: "approve" | "reject";
  onConfirm: (id: string, reason: string) => Promise<void>;
  onCancel: () => void;
}

export default function ApprovalModal({ approval, mode, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isReject = mode === "reject";
  const valid = reason.trim().length >= 8; // enforce real reason

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onConfirm(approval.id, reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-5 text-slate-200">
        <h2 id="approval-title" className="text-lg font-bold uppercase">
          {isReject ? "Reject" : "Approve"} — {approval.object}
        </h2>

        {/* Context — the README requires this */}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-400">Action</dt><dd>{approval.action}</dd>
          <dt className="text-slate-400">Tier</dt><dd>{approval.tier}</dd>
          <dt className="text-slate-400">Risk</dt>
          <dd className={approval.risk === "HIGH" ? "text-red-400" : ""}>
            {approval.risk}
          </dd>
          <dt className="text-slate-400">Requested by</dt>
          <dd>{approval.requestedBy ?? "—"}</dd>
        </dl>

        <label htmlFor="reason" className="mt-4 block text-sm">
          Reason <span className="text-slate-400">(required, audited)</span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm"
          placeholder={isReject ? "Why is this rejected?" : "Approval justification…"}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-2xl bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className={`rounded-2xl px-3 py-1 text-xs font-medium ${
              isReject
                ? "bg-red-300/30 text-red-500 hover:bg-red-300/50"
                : "bg-emerald-300/30 text-emerald-500 hover:bg-emerald-300/50"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {busy ? "Submitting…" : isReject ? "Confirm Reject" : "Confirm Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}