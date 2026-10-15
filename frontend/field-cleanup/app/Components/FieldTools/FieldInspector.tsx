"use client";

import { useState } from "react";
import {
  SalesforceAPI,
  type SalesforceObjectSummary,
  type SalesforceFieldMetadata,
  type SalesforceFieldUsage,
  type SalesforceReferenceScan,
} from "@/app/lib/api/salesforce";
import {
  panel,
  button,
  message,
  ErrorNotice,
  JsonDetails,
  Busy,
  FieldSelectors,
} from "./shared";

export default function FieldInspector({
  objects,
  initialObject = "",
  initialField = "",
}: {
  objects: SalesforceObjectSummary[];
  initialObject?: string;
  initialField?: string;
}) {
  const [object, setObject] = useState(initialObject);
  const [field, setField] = useState(initialField);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SalesforceFieldMetadata | null>(
    null,
  );
  const [usage, setUsage] = useState<SalesforceFieldUsage | null>(null);
  const [references, setReferences] = useState<SalesforceReferenceScan | null>(
    null,
  );
  function reset() {
    setMetadata(null);
    setUsage(null);
    setReferences(null);
    setError(null);
  }
  async function inspect(kind: "metadata" | "usage" | "references") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "metadata") {
        setMetadata(null);
        setMetadata((await SalesforceAPI.fieldMetadata(object, field)).field);
      }
      if (kind === "usage") {
        setUsage(null);
        setUsage(await SalesforceAPI.fieldUsage(object, field));
      }
      if (kind === "references") {
        setReferences(null);
        setReferences(await SalesforceAPI.scanReferences(object, field));
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-4">
      <div className={panel}>
        <h2 className="text-lg font-semibold">Inspect a single field</h2>
        <p className="mb-5 mt-1 text-sm text-slate-400">
          Refresh metadata, population, or references independently. Use
          Dependency Viewer for a combined risk assessment and cleanup
          proposals.
        </p>
        <FieldSelectors
          objects={objects}
          object={object}
          field={field}
          disabled={busy !== null}
          setObject={(value) => {
            setObject(value);
            reset();
          }}
          setField={(value) => {
            setField(value);
            reset();
          }}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          {(
            [
              ["metadata", "Load metadata"],
              ["usage", "Check population"],
              ["references", "Scan references"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              className={button}
              disabled={!object || !field || busy !== null}
              onClick={() => void inspect(kind)}
            >
              {busy === kind ? <Busy label="Checking…" /> : label}
            </button>
          ))}
        </div>
      </div>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <div className="grid gap-4 xl:grid-cols-2" aria-live="polite">
        {metadata && (
          <div className={panel}>
            <h3 className="font-semibold">
              {metadata.label}{" "}
              <span className="text-sm font-normal text-slate-400">
                {object}.{field}
              </span>
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              {[
                ["Type", metadata.type],
                [
                  "Custom field",
                  metadata.custom === undefined
                    ? "Unknown"
                    : metadata.custom
                      ? "Yes"
                      : "No",
                ],
                [
                  "Nullable",
                  metadata.nillable === undefined
                    ? "Unknown"
                    : metadata.nillable
                      ? "Yes"
                      : "No",
                ],
                [
                  "Calculated",
                  metadata.calculated === undefined
                    ? "Unknown"
                    : metadata.calculated
                      ? "Yes"
                      : "No",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-400">
              {metadata.description || "No description recorded."}
            </p>
            <JsonDetails value={metadata} />
          </div>
        )}
        {usage && (
          <div className={panel}>
            <h3 className="font-semibold">Field population</h3>
            <p className="mt-4 text-3xl font-bold text-blue-300">
              {usage.usage_percentage.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {usage.populated_records.toLocaleString()} populated of{" "}
              {usage.total_records.toLocaleString()} records
            </p>
            <p className="mt-4 text-sm">{usage.recommendation_hint}</p>
            <JsonDetails value={usage} />
          </div>
        )}
        {references && (
          <div className={`${panel} xl:col-span-2`}>
            <h3 className="font-semibold">
              {references.reference_count} references
            </h3>
            <p className="mt-2 text-sm text-slate-400">{references.summary}</p>
            <div className="mt-4 space-y-3">
              {references.all_references.map((reference, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-white/10 p-3 text-sm"
                >
                  <p className="break-words font-medium">
                    {reference.name ?? reference.id ?? reference.type}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {reference.type}
                    {reference.line_number
                      ? ` · Line ${reference.line_number}`
                      : ""}
                  </p>
                  {(reference.snippet || reference.description) && (
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                      {reference.snippet ?? reference.description}
                    </pre>
                  )}
                </div>
              ))}
            </div>
            <JsonDetails value={references} />
          </div>
        )}
      </div>
    </div>
  );
}
