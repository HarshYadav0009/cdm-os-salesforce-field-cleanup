import {
  Download,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

interface Props {
  object: string;
  field: string;
  population: number;
  references: number;
  hasReferences: boolean;
  errors: string[];
  summary: string;
  onExport: () => void;
}

export default function AssessmentSummary({
  object,
  field,
  population,
  references,
  hasReferences,
  errors,
  summary,
  onExport,
}: Props) {
  const incomplete = errors.length > 0;
  const candidate = !incomplete && population === 0 && !hasReferences;
  const Icon = incomplete
    ? AlertTriangle
    : candidate
      ? ShieldCheck
      : ShieldAlert;
  return (
    <section
      aria-label="Assessment summary"
      className={`rounded-2xl border p-4 sm:p-5 ${candidate ? "border-emerald-400/25 bg-emerald-500/5" : "border-amber-400/25 bg-amber-500/5"}`}
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <Icon
            className={`mt-1 h-5 w-5 shrink-0 ${candidate ? "text-emerald-300" : "text-amber-300"}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Assessment result
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              {incomplete
                ? "Assessment needs follow-up"
                : candidate
                  ? "Candidate for cleanup review"
                  : "Review usage and dependencies"}
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">
              {object}.{field}
            </p>
          </div>
        </div>
        <button
          onClick={onExport}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export assessment
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Field population", `${population.toFixed(1)}%`],
          ["Metadata references", references.toLocaleString()],
          ["Scan coverage", incomplete ? "Incomplete" : "Checks completed"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-base font-semibold text-slate-100">
              {value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 break-words text-sm leading-6 text-slate-300">
        {summary}
      </p>
      {incomplete && (
        <ul
          className="mt-3 space-y-1 text-xs text-amber-200"
          aria-label="Incomplete checks"
        >
          {errors.map((error, index) => (
            <li key={index} className="break-words">
              <p className="font-medium">
                {error.split(":")[0]} check could not complete.
              </p>
              <p className="mt-1 text-slate-400">
                {error.includes("INVALID_FIELD")
                  ? "Salesforce rejected the metadata query. Scan coverage is incomplete."
                  : "The metadata check failed. Review the diagnostic details and retry the assessment."}
              </p>
              <details className="mt-2 text-slate-400">
                <summary className="cursor-pointer">Diagnostic details</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-[11px]">
                  {error}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {candidate
          ? "No populated records or references were reported by these checks. Review the evidence before proposing a change; deletion still requires human approval."
          : incomplete
            ? "Review the evidence and resolve incomplete checks before requesting cleanup."
            : "Review the reported usage and dependencies before requesting cleanup."}
      </p>
    </section>
  );
}
