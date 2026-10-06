"use client";

import { AlertTriangle } from "lucide-react";

export interface FieldDetail {
  fieldLabel: string;
  dataType: string;
  usagePercent: number;
  recordsPopulated: string;
  totalReferences: number;
  highRiskDependencies: number;
  logs: string[];
}

interface DetailSectionProps {
  detail: FieldDetail;
  onGenerateReport?: () => void;
  onPauseAgent?: () => void;
}

export default function DetailSection({
  detail,
  onGenerateReport,
  onPauseAgent,
}: DetailSectionProps) {
  const {
    fieldLabel,
    dataType,
    usagePercent,
    recordsPopulated,
    totalReferences,
    highRiskDependencies,
    logs,
  } = detail;

  return (
    <div className="flex w-full flex-col gap-4 font-sans text-slate-200">
      {/* Field Information */}
      <section className="flex flex-col gap-1.5 rounded-lg border border-slate-700 p-3 text-sm">
        <Row label="Field" value={fieldLabel} />
        <Row label="Data Type" value={dataType} />
        <Row label="FieldSpy Usage %" value={`${usagePercent}%`} warn />
        <Row label="Records Populated" value={recordsPopulated} warn />
      </section>

      {/* Tabs (single active tab for now) */}
      <div className="rounded-t-lg border border-slate-700">
        <div className="inline-block -mb-px border-b-2 border-blue-500 px-4 py-2 text-sm font-medium text-slate-200">
          Field Context
        </div>
      </div>

      {/* Stats */}
      <section className="flex flex-col gap-1 rounded-md border border-slate-700/50 bg-[#1c1e26] p-4 text-sm shadow-sm">
        <div className="text-slate-300">
          Total References:{" "}
          <span className="text-white">{totalReferences}</span>
        </div>
        <div className="font-medium text-orange-500">
          High-Risk Dependencies: {highRiskDependencies}
        </div>
      </section>

      {/* Agent log */}
      <section className="flex max-h-48 flex-col gap-4 overflow-y-auto rounded-md border border-slate-700/50 bg-[#1c1e26] p-4 font-mono text-xs text-slate-300 shadow-sm">
        {logs.map((log, i) => (
          <p key={i} className="whitespace-pre-line leading-relaxed">
            {log}
          </p>
        ))}
      </section>

      {/* Actions */}
      <div className="mb-1 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onGenerateReport}
          className="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Generate Impact Report
        </button>
        <button
          onClick={onPauseAgent}
          className="flex-1 cursor-pointer rounded bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
        >
          Pause Agent
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-slate-100">{label}:</span>
      <span className="break-all text-slate-300">{value}</span>
      {warn && <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />}
    </div>
  );
}
