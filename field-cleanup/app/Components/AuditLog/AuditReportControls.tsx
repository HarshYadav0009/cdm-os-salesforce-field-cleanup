"use client";

import { useState } from "react";
import { csvCell, escapeHtml } from "@/app/lib/api/reportExport";
import { api } from "@/app/lib/api/client";
import type { AuditLogEntry } from "@/types/governance";

export type VerificationStatus = "Verified" | "Invalid" | "Missing" | "Not found";

export default function AuditReportControls({ entries, verification, onVerified }: {
  entries: AuditLogEntry[];
  verification: Record<string, VerificationStatus>;
  onVerified: (value: Record<string, VerificationStatus>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headers = ["Timestamp", "Event", "Actor", "Proposal", "Payload signature status", "Payload"];
  const rows = entries.map((entry) => [entry.created_at, entry.event_type, entry.actor, entry.proposal_id ?? "", verification[entry.id] ?? "Not verified", JSON.stringify(entry.payload)]);
  async function verify() {
    setBusy(true); setError(null);
    try {
      const result = await api<{ results: { id: string; status: VerificationStatus }[] }>("/audit/verify", { method: "POST", body: JSON.stringify({ ids: entries.map((entry) => entry.id) }) });
      onVerified(Object.fromEntries(result.results.map((entry) => [entry.id, entry.status])));
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
    report.document.write(`<!doctype html><html><head><title>CDM-OS Audit Report</title><style>body{font:12px system-ui;margin:24px;color:#172033}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #ccd3de;padding:8px;overflow-wrap:anywhere;text-align:left;vertical-align:top}th{background:#eef2f7}thead{display:table-header-group}@media print{button{display:none}body{margin:0}@page{size:A4 landscape;margin:12mm}}</style></head><body><h1>CDM-OS Audit Report</h1><p>Generated ${escapeHtml(new Date().toLocaleString())} · ${entries.length} filtered events from the latest 500 records.</p><p>Verification covers event payload signatures only. Missing verification is not evidence of integrity.</p><button onclick="window.print()">Print / Save as PDF</button><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
    report.document.close(); report.focus();
  }
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><h2 className="font-semibold text-white">Compliance report</h2><p className="mt-1 text-xs leading-5 text-slate-400">{entries.length} filtered events · latest 500 records. Verification checks payload signatures.</p></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => void verify()} disabled={busy || !entries.length} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Verifying…" : "Verify signatures"}</button>
        <button type="button" onClick={downloadCsv} disabled={!entries.length} className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm disabled:opacity-40">Download CSV</button>
        <button type="button" onClick={printReport} disabled={!entries.length} className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm disabled:opacity-40">Print / Save PDF</button>
      </div>
    </div>
    {Object.keys(verification).length > 0 && <p role="status" className="text-xs text-slate-300">Verified: {entries.filter((entry) => verification[entry.id] === "Verified").length} · Invalid: {entries.filter((entry) => verification[entry.id] === "Invalid").length} · Missing: {entries.filter((entry) => verification[entry.id] === "Missing").length}</p>}
    {error && <p role="alert" className="break-words text-sm text-rose-300">{error}</p>}
  </section>;
}
