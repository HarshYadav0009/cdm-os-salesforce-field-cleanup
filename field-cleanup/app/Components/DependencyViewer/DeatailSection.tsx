"use client";

import { Activity, AlertTriangle, Braces, Database, Layers3 } from "lucide-react";
import type { SalesforceFieldMetadata } from "@/app/lib/api/salesforce";

export interface FieldDetail {
  fieldLabel: string;
  dataType: string;
  usagePercent: number | null;
  recordsPopulated: string | null;
  totalReferences: number;
  logs: string[];
  metadata: SalesforceFieldMetadata | null;
}

interface DetailSectionProps {
  detail: FieldDetail;
}

export default function DetailSection({ detail }: DetailSectionProps) {
  const {
    fieldLabel,
    dataType,
    usagePercent,
    recordsPopulated,
    totalReferences,
    logs,
    metadata,
  } = detail;

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
      <header className="border-b border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300 ring-1 ring-violet-400/15">
            <Braces className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Field intelligence
            </p>
            <h2 className="mt-0.5 truncate text-sm font-semibold text-slate-100">
              {fieldLabel}
            </h2>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          {dataType}
          {metadata?.custom && <span className="text-slate-500">· Custom</span>}
        </div>
      </header>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 self-start">
          <StatCard
            icon={Activity}
            label="Populated"
            value={usagePercent === null ? "—" : `${usagePercent}%`}
            detail={recordsPopulated ?? "Run analysis"}
            warning={usagePercent === 0}
          />
          <StatCard
            icon={Layers3}
            label="References"
            value={String(totalReferences)}
            detail="Across code & metadata"
          />
        </div>

        <section className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Field metadata
            </h3>
          </div>
          {metadata ? (
            <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/50 px-3">
              <MetadataRow label="API name" value={metadata.name} mono />
              <MetadataRow label="Nullable" value={yesNo(metadata.nillable)} />
              <MetadataRow label="Createable" value={yesNo(metadata.createable)} />
              <MetadataRow label="Updateable" value={yesNo(metadata.updateable)} />
              <MetadataRow label="Calculated" value={yesNo(metadata.calculated)} />
              {metadata.length != null && (
                <MetadataRow label="Length" value={String(metadata.length)} />
              )}
              {metadata.precision != null && (
                <MetadataRow
                  label="Precision / scale"
                  value={`${metadata.precision} / ${metadata.scale ?? 0}`}
                />
              )}
              {metadata.description && (
                <div className="py-2.5">
                  <dt className="text-[10px] font-medium text-slate-500">Description</dt>
                  <dd className="mt-1 text-xs leading-5 text-slate-300">
                    {metadata.description}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-center text-xs text-slate-500">
              Select a field to inspect its metadata.
            </p>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-slate-500" />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Analysis notes
            </h3>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            {logs.map((log, index) => (
              <p
                key={`${index}-${log}`}
                className="flex gap-2 text-xs leading-5 text-slate-400"
              >
                {usagePercent === 0 ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : (
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                )}
                <span>{log}</span>
              </p>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-2 truncate text-xl font-semibold tabular-nums ${warning ? "text-amber-300" : "text-slate-100"}`}>
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] text-slate-500" title={detail}>
        {detail}
      </p>
    </div>
  );
}

function MetadataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd className={`truncate text-right text-[11px] text-slate-300 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function yesNo(value: boolean | undefined) {
  if (value === undefined) return "Not provided";
  return value ? "Yes" : "No";
}
