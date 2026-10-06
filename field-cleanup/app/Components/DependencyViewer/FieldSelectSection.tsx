"use client";

import Dropdown from "./Dropdown";

interface FieldSelectSectionProps {
  objectFields: Record<string, string[]>;
  object: string;
  field: string;
  fields: string[];
  onObjectChange: (obj: string) => void;
  onFieldChange: (field: string) => void;
  onAnalyze?: () => void;
}

export default function FieldSelectSection({
  objectFields,
  object,
  field,
  fields,
  onObjectChange,
  onFieldChange,
  onAnalyze,
}: FieldSelectSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Object
        </label>
        <Dropdown
          options={Object.keys(objectFields)}
          value={object}
          onChange={onObjectChange}
          ariaLabel="Select Salesforce object"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Field
        </label>
        <Dropdown
          options={fields}
          value={field}
          onChange={onFieldChange}
          placeholder="Select a field…"
          disabled={fields.length === 0}
          ariaLabel="Select field"
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1 lg:min-w-[220px] lg:items-end">
        <p className="text-sm text-slate-400 lg:text-right">
          Selected:{" "}
          <span className="font-medium text-slate-200">
            {object}.{field || "—"}
          </span>
        </p>
        <button
          onClick={onAnalyze}
          disabled={!field}
          className={[
            "w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:w-auto",
            field
              ? "cursor-pointer bg-blue-500 text-white hover:bg-blue-400"
              : "cursor-not-allowed bg-slate-700 text-slate-400",
          ].join(" ")}
        >
          Analyze Dependencies
        </button>
      </div>
    </div>
  );
}