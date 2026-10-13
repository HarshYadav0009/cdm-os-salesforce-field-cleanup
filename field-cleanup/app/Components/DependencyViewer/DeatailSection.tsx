"use client";

import { Braces, Database } from "lucide-react";
import type { SalesforceFieldMetadata } from "@/app/lib/api/salesforce";

export interface FieldDetail {
  fieldLabel: string;
  dataType: string;
  metadata: SalesforceFieldMetadata | null;
}

interface DetailSectionProps {
  detail: FieldDetail;
}

export default function DetailSection({ detail }: DetailSectionProps) {
  const {
    fieldLabel,
    dataType,
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

      <div className="p-4 sm:p-5">
        <section className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Field metadata
            </h3>
          </div>
          {metadata ? (
            <dl className="grid gap-x-6 rounded-xl border border-slate-800 bg-slate-950/50 px-3 sm:grid-cols-2">
              <MetadataRow label="API name" value={metadata.name} mono />
              <MetadataRow label="Nullable" value={yesNo(metadata.nillable)} />
              <MetadataRow
                label="Createable"
                value={yesNo(metadata.createable)}
              />
              <MetadataRow
                label="Updateable"
                value={yesNo(metadata.updateable)}
              />
              <MetadataRow
                label="Calculated"
                value={yesNo(metadata.calculated)}
              />
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
                <div className="border-t border-slate-800 py-2.5 sm:col-span-2">
                  <dt className="text-[10px] font-medium text-slate-500">
                    Description
                  </dt>
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

      </div>
    </aside>
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
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 py-2.5">
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 break-words text-right text-[11px] text-slate-300 [overflow-wrap:anywhere] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function yesNo(value: boolean | undefined) {
  if (value === undefined) return "Not provided";
  return value ? "Yes" : "No";
}
