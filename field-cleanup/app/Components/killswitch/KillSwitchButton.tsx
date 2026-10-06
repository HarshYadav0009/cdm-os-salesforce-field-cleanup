"use client";

import { useState } from "react";
import { GovernanceAPI } from "@/app/lib/api/governance";
import { useToast } from "@/app/Components/Toast/useToast";

type Scope = "agent" | "pod" | "capability" | "global";

export default function KillSwitchButton({
  scope,
  target,
}: {
  scope: Scope;
  target: string;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const required = `KILL ${scope.toUpperCase()} ${target}`;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPhrase("");
    setReason("");
  };

  const confirm = async () => {
    if (phrase !== required || reason.trim().length < 8 || busy) return;
    setBusy(true);
    try {
      if (scope !== "agent") {
        throw new Error("The backend only supports changing an individual agent status.");
      }
      await GovernanceAPI.updateAgentStatus(target, "PAUSED");
      toast.success(`Agent ${target} status set to PAUSED.`, "Agent paused");
      setOpen(false);
      setPhrase("");
      setReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to activate the kill switch.",
        "Emergency stop failed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Emergency stop ${scope} ${target}`}
        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
      >
        Emergency stop
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kill-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-rose-500/30 bg-slate-900 p-5">
            <h2 id="kill-confirm-title" className="text-lg font-semibold text-white">
              Confirm emergency stop
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              This action is audited and may interrupt active work.
            </p>
            <label htmlFor="kill-button-reason" className="mt-5 block text-xs text-slate-300">
              Reason (required, at least 8 characters)
            </label>
            <textarea
              id="kill-button-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200"
            />
            <label htmlFor="kill-button-phrase" className="mt-4 block text-xs text-slate-300">
              Type <code className="rounded bg-slate-800 px-1">{required}</code> to arm
            </label>
            <input
              id="kill-button-phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={close} className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                disabled={phrase !== required || reason.trim().length < 8 || busy}
                onClick={() => void confirm()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Sending request…" : "Confirm stop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
