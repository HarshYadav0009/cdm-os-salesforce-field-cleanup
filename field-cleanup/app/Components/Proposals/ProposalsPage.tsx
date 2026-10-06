"use client";

import { useEffect, useState } from "react";
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
                        onClick={() =>
                          setSelectedProposalId((current) =>
                            current === proposal.id ? null : proposal.id,
                          )
                        }
                        aria-expanded={selectedProposalId === proposal.id}
                        className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {selectedProposalId === proposal.id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedProposal && (
          <div className="border-t border-slate-700 p-4">
            <h2 className="mb-3 text-sm font-semibold">Proposal details</h2>
            <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-400">ID</dt><dd className="break-all font-mono text-xs">{selectedProposal.id}</dd></div>
              <div><dt className="text-slate-400">Human approval required</dt><dd>{selectedProposal.policy_result?.requires_human_approval ? "Yes" : "No"}</dd></div>
              <div><dt className="text-slate-400">Policy allowed</dt><dd>{selectedProposal.policy_result ? (selectedProposal.policy_result.allowed ? "Yes" : "No") : "Not provided"}</dd></div>
              <div><dt className="text-slate-400">Matched rules</dt><dd>{selectedProposal.policy_result?.matched_rules.join(", ") || "None"}</dd></div>
            </dl>
            <h3 className="mb-2 text-sm font-semibold">Input payload</h3>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs text-slate-300">
              {JSON.stringify(selectedProposal.input_payload, null, 2)}
            </pre>
          </div>
        )}
      </div>

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
