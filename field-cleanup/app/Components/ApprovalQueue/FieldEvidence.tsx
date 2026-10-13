"use client";

import { useEffect, useState } from "react";
import { SalesforceAPI, type SalesforceFieldMetadata, type SalesforceFieldUsage, type SalesforceReferenceScan } from "@/app/lib/api/salesforce";

export default function FieldEvidence({ payload }: { payload: Record<string, unknown> }) {
  const object = String(payload.object_name ?? payload.object_api_name ?? payload.object ?? "");
  const field = String(payload.field_name ?? payload.field_api_name ?? payload.field ?? "");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    metadata?: SalesforceFieldMetadata;
    usage?: SalesforceFieldUsage;
    references?: SalesforceReferenceScan;
    errors: string[];
    loadedAt: string;
    revision: number;
  } | null>(null);

  useEffect(() => {
    if (!object || !field) return;
    let active = true;
    void Promise.allSettled([
      SalesforceAPI.fieldMetadata(object, field),
      SalesforceAPI.fieldUsage(object, field),
      SalesforceAPI.scanReferences(object, field),
    ]).then(([metadata, usage, references]) => {
      if (!active) return;
      setResult({
        metadata: metadata.status === "fulfilled" ? metadata.value.field : undefined,
        usage: usage.status === "fulfilled" ? usage.value : undefined,
        references: references.status === "fulfilled" ? references.value : undefined,
        errors: [metadata, usage, references].flatMap((item, index) => item.status === "rejected"
          ? [`${["Metadata", "Population", "References"][index]}: ${item.reason instanceof Error ? item.reason.message : "Unable to load"}`] : []),
        loadedAt: new Date().toLocaleString(), revision,
      });
    });
    return () => { active = false; };
  }, [object, field, revision]);

  if (!object || !field) return <p className="text-sm text-slate-400">This proposal has no field target to inspect.</p>;
  const loading = !result || result.revision !== revision;
  const risk = !result || result.errors.length ? "Incomplete evidence"
    : result.metadata?.custom !== true || !field.endsWith("__c") ? "Protected field"
    : result.references?.has_references ? "High · dependencies found"
    : (result.usage?.usage_percentage ?? 0) > 0 ? "Review · populated field"
    : "Low · no population or scanned references";
  return (
    <section className="space-y-3 rounded-xl border border-blue-400/20 bg-slate-950/60 p-4" aria-label="Field evidence">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">Live field evidence</h3>
        <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)} className="min-h-11 rounded-lg border border-slate-700 px-3 text-xs text-blue-300 disabled:opacity-50">Refresh evidence</button>
      </div>
      <p className="break-all font-mono text-xs text-slate-400">{object}.{field}</p>
      {loading ? <p role="status" className="text-sm text-blue-300">Loading metadata, population, and dependencies…</p> : <>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[["Population", result.usage ? `${result.usage.usage_percentage.toFixed(1)}%` : "Unavailable"], ["References", result.references ? String(result.references.reference_count) : "Unavailable"], ["Field type", result.metadata?.type ?? "Unavailable"]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 break-words font-semibold text-white">{value}</p></div>)}
        </div>
        <p className={`text-sm ${risk.startsWith("Low") ? "text-emerald-300" : "text-amber-300"}`}>Assessment: {risk}</p>
        <p className="text-xs leading-5 text-slate-400">Refreshed {result.loadedAt}. This is current evidence, not a snapshot from submission. External integrations still require human review.</p>
        {result.errors.map((error) => <p role="alert" key={error} className="break-words text-xs text-rose-300">{error}</p>)}
        {result.references && <details className="text-xs"><summary className="min-h-11 cursor-pointer py-3 text-blue-300">Dependency details ({result.references.reference_count})</summary><p className="mb-2 text-slate-400">{result.references.summary}</p><ul className="max-h-48 space-y-2 overflow-auto">{result.references.all_references.map((reference, index) => <li key={index} className="rounded-lg border border-slate-800 p-3"><p className="break-words text-white">{reference.name ?? reference.id ?? reference.type}</p><p className="text-slate-400">{reference.type}</p><p className="whitespace-pre-wrap break-words text-slate-300">{reference.snippet ?? reference.description}</p></li>)}</ul></details>}
      </>}
    </section>
  );
}
