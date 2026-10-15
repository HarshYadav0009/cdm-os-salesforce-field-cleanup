"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import {
  SalesforceAPI,
  type SalesforceObjectSummary,
  type SalesforceFieldMetadata,
} from "@/app/lib/api/salesforce";

export const panel =
  "rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-6";
export const input =
  "w-full min-w-0 rounded-lg border border-white/15 bg-[#080d18] px-3 py-2.5 text-sm text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50";
export const button =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:opacity-50";
export const secondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50";
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request failed. Please retry.";
}
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-200"
    >
      {children}
    </p>
  );
}
export function JsonDetails({ value }: { value: unknown }) {
  return (
    <details className="mt-4 text-sm text-slate-400">
      <summary className="cursor-pointer hover:text-white">
        View response details
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-black/25 p-3 text-xs text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
export function Busy({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}
export function FieldSelectors({
  objects,
  object,
  field,
  setObject,
  setField,
  disabled,
  showField = true,
}: {
  objects: SalesforceObjectSummary[];
  object: string;
  field: string;
  setObject: (value: string) => void;
  setField: (value: string) => void;
  disabled: boolean;
  showField?: boolean;
}) {
  const [fields, setFields] = useState<SalesforceFieldMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedObject, setLoadedObject] = useState("");
  const [revision, setRevision] = useState(0);
  const loading = Boolean(
    object && showField && object !== loadedObject && !error,
  );
  useEffect(() => {
    if (!object || !showField) return;
    const controller = new AbortController();
    void SalesforceAPI.describeObject(object, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setFields(result.fields);
        setLoadedObject(object);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(message(error));
        }
      });
    return () => controller.abort();
  }, [object, revision, showField]);
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Salesforce object</span>
          <select
            className={input}
            value={object}
            disabled={disabled}
            onChange={(event) => {
              setObject(event.target.value);
              setField("");
              setFields([]);
              setLoadedObject("");
              setError(null);
            }}
          >
            <option value="">Choose an object</option>
            {objects.map((item) => (
              <option key={item.name} value={item.name}>
                {item.label} ({item.name})
              </option>
            ))}
          </select>
        </label>
        {showField && (
          <label className="space-y-2 text-sm text-slate-300">
            <span>Field</span>
            <select
              className={input}
              value={field}
              disabled={disabled || !object || loading}
              onChange={(event) => setField(event.target.value)}
            >
              <option value="">
                {loading ? "Loading fields…" : "Choose a field"}
              </option>
              {fields.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.label} ({item.name})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <ErrorNotice>
          {error}{" "}
          <button
            className={`${secondary} ml-2`}
            disabled={disabled}
            onClick={() => {
              setError(null);
              setLoadedObject("");
              setRevision((value) => value + 1);
            }}
          >
            Retry fields
          </button>
        </ErrorNotice>
      )}
    </div>
  );
}
