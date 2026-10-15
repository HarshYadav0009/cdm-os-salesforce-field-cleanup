"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";
import type { Proposal } from "@/types/governance";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function StatusBadge({ status }: { status: Proposal["status"] }) {
  const color =
    status === "POLICY_APPROVED" || status === "HUMAN_APPROVED" || status === "COMPLETED"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "POLICY_DENIED" || status === "HUMAN_REJECTED" || status === "FAILED"
        ? "bg-rose-500/15 text-rose-300"
        : status === "PENDING_HUMAN_APPROVAL"
          ? "bg-amber-500/15 text-amber-300"
          : "bg-slate-700 text-slate-200";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function ProposalsPage() {
  const source = useApiResource<Proposal[]>("/proposals/", []);
  const { reload } = source;
  const { subscribe } = useRealtime();
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const selectedProposal = source.data.find(({ id }) => id === selectedProposalId);

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type.startsWith("proposal.")) reload();
      }),
    [reload, subscribe],
  );

  useEffect(() => {
    if (!selectedProposal) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProposalId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedProposal]);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Proposals</h1>
        <p className="mt-1 text-sm text-slate-400">
          All proposals returned by <code>GET /proposals/</code>, including policy-approved,
          denied, and human-review items.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        {source.loading && source.data.length === 0 ? (
          <p role="status" className="px-4 py-10 text-center text-sm text-slate-400">
            Loading proposals…
          </p>
        ) : source.data.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No proposals were returned by the API.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase text-slate-300">
                <tr>
                  <th className="px-4 py-3">Proposal</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Tool</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {source.data.map((proposal) => (
                  <tr key={proposal.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs" title={proposal.id}>
                      {proposal.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">{proposal.agent_id}</td>
                    <td className="px-4 py-3">{proposal.tool_id}</td>
                    <td className="px-4 py-3">{proposal.tier}</td>
                    <td className="px-4 py-3"><StatusBadge status={proposal.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(proposal.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedProposalId(proposal.id)}
                        aria-haspopup="dialog"
                        className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {selectedProposal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProposalId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="proposal-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <h2 id="proposal-details-title" className="text-base font-semibold text-white">
                  Proposal details
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-400">
                  {selectedProposal.id}
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setSelectedProposalId(null)}
                aria-label="Close proposal details"
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[calc(90vh-76px)] space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <StatusBadge status={selectedProposal.status} />
                <span>{selectedProposal.agent_id}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedProposal.tool_id}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedProposal.tier}</span>
              </div>
              <section
                aria-labelledby="proposal-policy-title"
                className={`rounded-lg border p-4 ${
                  selectedProposal.policy_result
                    ? selectedProposal.policy_result.allowed
                      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                      : "border-rose-500/20 bg-rose-500/[0.04]"
                    : "border-slate-700 bg-slate-950/50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id="proposal-policy-title"
                    className="text-sm font-semibold text-white"
                  >
                    Policy decision
                  </h3>
                  {selectedProposal.policy_result && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        selectedProposal.policy_result.allowed
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {selectedProposal.policy_result.allowed
                        ? selectedProposal.policy_result.requires_human_approval
                          ? "Allowed · human approval required"
                          : "Allowed"
                        : "Rejected by policy"}
                    </span>
                  )}
                </div>
                {selectedProposal.policy_result ? (
                  <div className="mt-3 space-y-3 text-xs">
                    <div>
                      <p className="mb-1 font-medium text-slate-300">
                        Matched policy rules
                      </p>
                      {selectedProposal.policy_result.matched_rules.length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedProposal.policy_result.matched_rules.map(
                            (rule) => (
                              <li
                                key={rule}
                                className="flex items-start gap-2 text-slate-300"
                              >
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                                <span className="break-words">
                                  <span className="font-mono text-blue-200">
                                    {rule}
                                  </span>
                                  {rule === "implicit_tier1_allow" &&
                                    " — Tier 1 read-only tools are implicitly allowed."}
                                  {rule === "implicit_tier3_hitl_requirement" &&
                                    " — Tier 3 tools require human approval."}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p className="text-slate-400">
                          No matching policy rules were recorded.
                        </p>
                      )}
                    </div>
                    {!selectedProposal.policy_result.allowed && (
                      <div>
                        <p className="mb-1 font-medium text-rose-200">
                          Denial reasons
                        </p>
                        {selectedProposal.policy_result.denial_reasons.length >
                        0 ? (
                          <ul className="space-y-1.5">
                            {selectedProposal.policy_result.denial_reasons.map(
                              (reason, index) => (
                                <li
                                  key={`${index}-${reason}`}
                                  className="break-words text-rose-200/90"
                                >
                                  {reason}
                                </li>
                              ),
                            )}
                          </ul>
                        ) : (
                          <p className="text-slate-400">
                            The policy engine did not include a specific denial
                            reason.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    No policy evaluation details were recorded for this
                    proposal.
                  </p>
                )}
              </section>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-400">Created</dt>
                  <dd className="mt-1 text-slate-200">{formatDate(selectedProposal.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Human approval required</dt>
                  <dd className="mt-1 text-slate-200">
                    {selectedProposal.policy_result?.requires_human_approval ? "Yes" : "No"}
                  </dd>
                </div>
                {selectedProposal.human_decision && (
                  <>
                    <div>
                      <dt className="text-xs text-slate-400">Human decision</dt>
                      <dd className="mt-1 text-slate-200">
                        {selectedProposal.human_decision.decision} by{" "}
                        {selectedProposal.human_decision.reviewer_email}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Decision time</dt>
                      <dd className="mt-1 text-slate-200">
                        {formatDate(selectedProposal.human_decision.decided_at)}
                      </dd>
                    </div>
                    {selectedProposal.human_decision.reason && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-400">Decision reason</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-slate-200">
                          {selectedProposal.human_decision.reason}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                {selectedProposal.error_message && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-rose-300">Execution error</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-rose-200">
                      {selectedProposal.error_message}
                    </dd>
                  </div>
                )}
              </dl>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Input payload
                </h3>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                  {JSON.stringify(selectedProposal.input_payload, null, 2)}
                </pre>
              </div>
              {selectedProposal.execution_result && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Execution result
                  </h3>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                    {JSON.stringify(selectedProposal.execution_result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {source.error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          <span>Unable to load proposals: {source.error}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded-md border border-rose-400/40 px-3 py-1.5 font-medium hover:bg-rose-500/10"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
