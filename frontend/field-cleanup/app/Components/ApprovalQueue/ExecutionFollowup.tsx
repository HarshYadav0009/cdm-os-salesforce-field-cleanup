"use client";

import { useApiResource } from "@/app/lib/api/useApiResource";
import { usePolling } from "@/app/lib/api/usePolling";
import type { Proposal } from "@/types/governance";

export default function ExecutionFollowup({ id, onDismiss }: { id: string; onDismiss: () => void }) {
  const source = useApiResource<Proposal | null>(`/proposals/${encodeURIComponent(id)}`, null);
  usePolling(source.reload, 3000);
  const proposal = source.data;
  return <section aria-live="polite" className="space-y-3 rounded-xl border border-blue-400/20 bg-slate-900 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-white">Latest approved execution</h2><button type="button" onClick={onDismiss} className="min-h-11 rounded-lg border border-slate-700 px-3 text-xs text-slate-300">Dismiss</button></div>
    <p className="break-all font-mono text-xs text-slate-400">{id}</p>
    {source.error ? <p role="alert" className="break-words text-sm text-rose-300">Status unavailable: {source.error}</p> : !proposal ? <p className="text-sm text-blue-300">Loading execution status…</p> : <>
      <p className={`text-sm font-semibold ${proposal.status === "FAILED" ? "text-rose-300" : proposal.status === "COMPLETED" ? "text-emerald-300" : "text-blue-300"}`}>{proposal.status.replaceAll("_", " ")}</p>
      {proposal.status === "EXECUTING" && <p className="text-xs text-slate-400">Execution is running. Updates refresh every 3 seconds.</p>}
      {proposal.error_message && <p className="whitespace-pre-wrap break-words text-sm text-rose-300">{proposal.error_message}</p>}
      {proposal.execution_result && <details className="text-xs"><summary className="min-h-11 cursor-pointer py-3 text-blue-300">View execution result</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3">{JSON.stringify(proposal.execution_result, null, 2)}</pre></details>}
      <p className="text-xs text-slate-400">Full activity and all executions are available in Proposals.</p>
    </>}
  </section>;
}
