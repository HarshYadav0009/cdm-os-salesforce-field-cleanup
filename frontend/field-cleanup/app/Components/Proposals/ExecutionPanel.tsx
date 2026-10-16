"use client";

import { useState } from "react";
import type { ExecutionResponse } from "@/app/lib/api/governance";
import { GovernanceAPI, getRecordedDecision, executionResponse } from "@/app/lib/api/governance";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { proposalAuditEvents } from "@/app/lib/api/contracts";
import { usePolling } from "@/app/lib/api/usePolling";
import type { Proposal, AuditLogEntry } from "@/types/governance";

export default function ExecutionPanel({ proposal, reload }: { proposal: Proposal; reload: () => void }) {
  const [submittedExecution, setExecution] = useState<ExecutionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeline = useApiResource<AuditLogEntry[]>(`/audit/?proposal_id=${encodeURIComponent(proposal.id)}&limit=500`, []);
  usePolling(timeline.reload);
  const events = proposalAuditEvents(timeline.data, proposal.id);
  const execution = submittedExecution?.status === "EXECUTING" && ["COMPLETED", "FAILED"].includes(proposal.status)
    ? { ...executionResponse(proposal), ...(submittedExecution.execution_id ? { execution_id: submittedExecution.execution_id } : {}) }
    : submittedExecution;
  const executable = !execution && (["HUMAN_APPROVED", "POLICY_APPROVED"].includes(proposal.status) || (proposal.status === "DECIDED" && getRecordedDecision(proposal.id) === "APPROVED") || (proposal.status === "DECIDED" && proposal.human_decision?.decision === "APPROVED"));
  async function execute() {
    if (busy || !executable) return;
    setBusy(true); setError(null);
    try {
      const result = await GovernanceAPI.executeProposal(proposal.id);
      setExecution(result);
      reload(); timeline.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Execution could not be dispatched.");
      reload();
    } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h3 className="text-sm font-semibold text-white">Execution progress</h3><p className="mt-1 break-words text-xs text-slate-400">{proposal.status === "EXECUTING" ? "Running. Status refreshes automatically every 10 seconds." : proposal.status === "FAILED" ? "Execution failed. Review the error and current Salesforce state before submitting a new proposal." : proposal.status === "PENDING_HUMAN_APPROVAL" ? "Waiting for a decision in Approval Queue." : proposal.status === "COMPLETED" ? "Execution completed. Results are shown below." : executable ? "Approved and ready to execute." : "This proposal cannot be executed in its current state."}</p></div>
      {executable && <button type="button" onClick={() => void execute()} disabled={busy} className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Dispatching…" : "Execute approved proposal"}</button>}
    </div>
    {execution && <div role="status" className="space-y-2 text-sm"><p>{execution.execution_id ? `Execution ${execution.execution_id}` : `Proposal ${proposal.id}`}: {execution.status}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-900 p-3 text-xs">{JSON.stringify(execution.result, null, 2)}</pre>{execution.error_message && <p className="text-rose-300">{execution.error_message}</p>}</div>}
    {proposal.status === "DECIDED" && !proposal.human_decision && !getRecordedDecision(proposal.id) && <p className="text-xs text-amber-300">A decision is recorded, but its outcome was not supplied. Execution requires a confirmed approval.</p>}
    {error && <p role="alert" className="break-words text-sm text-rose-300">{error}</p>}
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Activity timeline</h4>
    {timeline.error ? <p role="alert" className="text-xs text-rose-300">{timeline.error}</p> : timeline.loading && !events.length ? <p role="status" className="text-xs text-slate-400">Loading activity…</p> : !events.length ? <p className="text-xs text-slate-400">No audit events returned for this proposal.</p> : <ol className="max-h-64 space-y-3 overflow-auto border-l border-slate-700 pl-4">{events.map((event) => <li key={event.id} className="min-w-0"><p className="break-words text-xs font-medium text-slate-200">{event.event_type.replaceAll("_", " ")}</p><p className="break-words text-xs text-slate-500">{new Date(event.created_at).toLocaleString()} · {event.actor}</p></li>)}</ol>}
  </section>;
}
