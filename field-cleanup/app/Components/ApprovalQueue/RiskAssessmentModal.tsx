"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { QueueRow } from "./QueueTable";

interface RiskAssessmentModalProps {
  isOpen: boolean;
  row: QueueRow | null;
  onClose: () => void;
  initialDecision?: "approve" | "reject";
  onApprove?: (row: QueueRow, reviewerEmail: string, reason: string) => Promise<void>;
  onReject?: (row: QueueRow, reviewerEmail: string, reason: string) => Promise<void>;
}

export default function RiskAssessmentModal({
  isOpen,
  row,
  onClose,
  initialDecision,
  onApprove,
  onReject,
}: RiskAssessmentModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(initialDecision ?? null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  /* Close on ESC + lock body scroll while open */
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus the panel for keyboard users
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !row) return null;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail.trim());

  const submit = async () => {
    if (!decision || !validEmail || reason.trim().length < 8 || busy) return;
    setBusy(true);
    try {
      await (decision === "approve" ? onApprove : onReject)?.(
        row,
        reviewerEmail.trim(),
        reason.trim(),
      );
    } finally {
      setBusy(false);
    }
  };

  const policyResult = row.proposal.policy_result;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 text-slate-300 outline-none sm:max-h-[90vh] sm:rounded-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 p-4">
          <h2
            id="risk-modal-title"
            className="text-sm font-bold text-white sm:text-base"
          >
            Detailed Risk Assessment: {row.targetName}: {row.action}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <section className="space-y-1">
            <p>
              <span className="font-bold text-white">Proposal:</span> {row.id}
            </p>
            <p>
              <span className="font-bold text-white">Agent:</span>{" "}
              {row.proposal.agent_id}
            </p>
            <p>
              <span className="font-bold text-white">Tier:</span>{" "}
              {row.proposal.tier}
            </p>
            <p>
              <span className="font-bold text-white">Tool:</span>{" "}
              {row.proposal.tool_id}
            </p>
          </section>

          <hr className="border-slate-700" />

          <section>
            <h3 className="mb-2 text-sm font-bold text-white sm:text-base">
              Proposed input
            </h3>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs text-slate-300">
              {JSON.stringify(row.proposal.input_payload, null, 2)}
            </pre>
          </section>

          <hr className="border-slate-700" />

          <section>
            <h3 className="mb-2 text-sm font-bold text-white sm:text-base">
              Policy evaluation
            </h3>
            {policyResult ? (
              <div className="space-y-2">
                <p>
                  Allowed: {policyResult.allowed ? "Yes" : "No"} · Human approval
                  required: {policyResult.requires_human_approval ? "Yes" : "No"}
                </p>
                {policyResult.matched_rules.length > 0 && (
                  <p>Matched rules: {policyResult.matched_rules.join(", ")}</p>
                )}
                {policyResult.denial_reasons.length > 0 && (
                  <p className="text-rose-300">
                    Denial reasons: {policyResult.denial_reasons.join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-400">
                No policy evaluation details were returned for this proposal.
              </p>
            )}
          </section>
          <section>
            <label htmlFor="reviewer-email" className="mb-2 block text-sm font-semibold text-white">
              Reviewer email <span className="font-normal text-slate-400">(required)</span>
            </label>
            <input
              id="reviewer-email"
              type="email"
              autoComplete="email"
              value={reviewerEmail}
              onChange={(event) => setReviewerEmail(event.target.value)}
              placeholder="reviewer@example.com"
              className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
            />
            <label htmlFor="approval-reason" className="mb-2 block text-sm font-semibold text-white">
              Decision reason <span className="font-normal text-slate-400">(required, audited)</span>
            </label>
            <textarea
              id="approval-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={decision === "reject" ? "Explain why this proposal is rejected…" : "Explain why this proposal is approved…"}
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
            />
          </section>
        </div>

        {/* Sticky footer actions */}
        <div className="flex flex-col gap-2 border-t border-slate-700 bg-slate-900 p-3 sm:flex-row sm:gap-3 sm:p-4">
          <button
            onClick={() => setDecision("approve")}
            aria-pressed={decision === "approve"}
            className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-md px-4 py-2 text-white transition-colors ${decision === "approve" ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            <span className="text-sm font-semibold uppercase tracking-wide">
              Approve Remediation
            </span>
            <span className="mt-0.5 text-xs text-blue-200">
              (Releases Token)
            </span>
          </button>

          <button
            onClick={() => setDecision("reject")}
            aria-pressed={decision === "reject"}
            className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-md px-4 py-2 text-white transition-colors ${decision === "reject" ? "bg-rose-700" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            <span className="text-sm font-semibold uppercase tracking-wide">
              Reject Proposal
            </span>
            <span className="mt-0.5 text-xs text-slate-400">
              (Rollback Workflow)
            </span>
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!decision || !validEmail || reason.trim().length < 8 || busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Recording…" : "Record decision"}
          </button>
        </div>
      </div>
    </div>
  );
}