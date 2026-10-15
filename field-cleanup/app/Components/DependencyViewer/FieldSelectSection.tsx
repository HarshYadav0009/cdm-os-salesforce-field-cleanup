"use client";

import { ArrowRight, Database, Search } from "lucide-react";
import Dropdown from "./Dropdown";

interface FieldSelectSectionProps {
  objects: string[];
  object: string;
  field: string;
  fields: string[];
  loadingObjects: boolean;
  loadingFields: boolean;
  analyzing: boolean;
  onObjectChange: (obj: string) => void;
  onFieldChange: (field: string) => void;
  onAnalyze?: () => void;
}

export default function FieldSelectSection({
  objects,
  object,
  field,
  fields,
  loadingObjects,
  loadingFields,
  analyzing,
  onObjectChange,
  onFieldChange,
  onAnalyze,
}: FieldSelectSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-xl bg-blue-500/10 p-2.5 text-blue-300 ring-1 ring-blue-400/15">
          <Database className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Choose a field to inspect
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Select a Salesforce object, then choose one of its fields.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Salesforce object
          </label>
          {loadingObjects ? (
            <div
              role="status"
              className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 text-xs text-slate-400"
            >
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
              Loading objects…
            </div>
          ) : (
            <Dropdown
              options={objects}
              value={object}
              onChange={onObjectChange}
              disabled={analyzing || objects.length === 0}
              ariaLabel="Select object"
              placeholder="Choose an object…"
            />
          )}
        </div>

        <ArrowRight className="hidden h-4 w-4 text-slate-600 lg:mb-4 lg:block" />

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Field
          </label>
          {loadingFields ? (
            <div
              role="status"
              className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 text-xs text-slate-400"
            >
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
              Loading fields…
            </div>
          ) : (
            <Dropdown
              options={fields}
              value={field}
              onChange={onFieldChange}
              placeholder="Choose a field…"
              disabled={analyzing || fields.length === 0}
              ariaLabel="Select field"
            />
          )}
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!field || analyzing || loadingObjects || loadingFields}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none lg:w-auto"
        >
          {analyzing ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {analyzing ? "Analyzing…" : "Analyze dependencies"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs">
        <span className="text-slate-500">Selected target</span>
        <span className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 font-mono text-slate-300">
          {object || "Object"}.{field || "Field"}
        </span>
        {fields.length > 0 && !loadingFields && (
          <span className="text-slate-600">
            {fields.length.toLocaleString()} fields available
          </span>
        )}
      </div>
    </section>
  );
}
