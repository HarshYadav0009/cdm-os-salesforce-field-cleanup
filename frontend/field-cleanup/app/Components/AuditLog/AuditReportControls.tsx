"use client";

import { useState } from "react";
import { csvCell, escapeHtml } from "@/app/lib/api/reportExport";
import { GovernanceAPI } from "@/app/lib/api/governance";
import type { AuditLogEntry } from "@/types/governance";

export type VerificationStatus = "Verified" | "Invalid" | "Missing" | "Not found";

export default function AuditReportControls({ entries }: {
  entries: AuditLogEntry[];
}) {
  const [proposalId, setProposalId] = useState("");
  const [token, setToken] = useState("");
  const [verificationResponse, setVerificationResponse] = useState<unknown>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headers = ["Timestamp", "Event", "Actor", "Proposal", "Payload signature status", "HMAC signature", "Payload"];
  const rows = entries.map((entry) => [entry.created_at, entry.event_type, entry.actor, entry.proposal_id ?? "", entry.hmac_signature ? "Present (unverified)" : "Not supplied", entry.hmac_signature ?? "", JSON.stringify(entry.payload)]);
  async function verify() {
    if (busy || !proposalId.trim() || !token.trim()) return;
    setBusy(true); setError(null); setVerificationSent(false);
    try {
      const result = await GovernanceAPI.verifyAudit(proposalId.trim(), token.trim());
      setVerificationResponse(result);
      setVerificationSent(true);
      setToken("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Verification unavailable."); }
    finally { setBusy(false); }
  }
  function downloadCsv() {
    const blob = new Blob(["\uFEFF", [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `cdm-audit-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function printReport() {
    setError(null);
    const report = window.open("", "_blank");
    if (!report) { setError("Allow popups to open the printable report, then choose Save as PDF in the print dialog."); return; }
    report.opener = null;
    report.document.write(`<!doctype html><html><head><title>CDM-OS Audit Report</title><style>body{font:12px system-ui;margin:24px;color:#172033}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #ccd3de;padding:8px;overflow-wrap:anywhere;text-align:left;vertical-align:top}th{background:#eef2f7}thead{display:table-header-group}@media print{button{display:none}body{margin:0}@page{size:A4 landscape;margin:12mm}}</style></head><body><h1>CDM-OS Audit Report</h1><p>Generated ${escapeHtml(new Date().toLocaleString())} · ${entries.length} filtered events from the returned records.</p><p>Proposal verification is requested separately with a token. Signatures are exported when supplied; their presence alone does not establish verification.</p><button onclick="window.print()">Print / Save as PDF</button><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
    report.document.close(); report.focus();
  }
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><h2 className="font-semibold text-white">Compliance report</h2><p className="mt-1 text-xs leading-5 text-slate-400">{entries.length} filtered events · returned records. Verification requires a proposal ID and token.</p></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => void verify()} disabled={busy || !proposalId.trim() || !token.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Verifying…" : "Verify proposal"}</button>
        <button type="button" onClick={downloadCsv} disabled={!entries.length} className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm disabled:opacity-40">Download CSV</button>
        <button type="button" onClick={printReport} disabled={!entries.length} className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm disabled:opacity-40">Print / Save PDF</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-slate-300">Proposal ID<input value={proposalId} onChange={(event) => setProposalId(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2" /></label>
      <label className="text-xs text-slate-300">Verification token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2" /></label>
    </div>
    {verificationSent && <div role="status" className="text-xs text-slate-300">Verification request completed.{verificationResponse != null && <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(verificationResponse, null, 2)}</pre>}</div>}

    {error && <p role="alert" className="break-words text-sm text-rose-300">{error}</p>}
  </section>;
}
