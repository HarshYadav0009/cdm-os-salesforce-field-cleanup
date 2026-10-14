"use client";

import {
  Archive,
  ArrowRight,
  Loader2,
  ShieldAlert,
  WandSparkles,
} from "lucide-react";
import type { ToolDefinition } from "@/types/governance";

const actions = [
  {
    id: "salesforce_backup_field_def",
    title: "Save a metadata backup",
    label: "Propose metadata backup",
    icon: Archive,
    color: "text-blue-300",
    tint: "bg-blue-500/10",
    description: "Capture the field definition before making changes.",
    detail: "Saves metadata and description. Record values are not included.",
  },
  {
    id: "salesforce_deprecate_field",
    title: "Mark the field deprecated",
    label: "Propose deprecation",
    icon: WandSparkles,
    color: "text-amber-300",
    tint: "bg-amber-500/10",
    description:
      "Tag the description to signal that this field is being retired.",
    detail: "Keeps the field, data, and permissions in place.",
  },
  {
    id: "salesforce_delete_field",
    title: "Request field deletion",
    label: "Request deletion review",
    icon: ShieldAlert,
    color: "text-rose-300",
    tint: "bg-rose-500/10",
    description: "Submit a deletion request for human approval.",
    detail:
      "Creates a metadata backup before deletion. The backup cannot restore the field or record data.",
  },
] as const;

interface Props {
  object: string;
  field: string;
  custom: boolean;
  tools: ToolDefinition[];
  loading: boolean;
  error: string | null;
  submitting: string | null;
  reason: string;
  confirmed: boolean;
  onReasonChange: (value: string) => void;
  onConfirmChange: (value: boolean) => void;
  onSubmit: (id: string, label: string) => void;
  onRetry: () => void;
}

export default function RemediationProposals({
  object,
  field,
  custom,
  tools,
  loading,
  error,
  submitting,
  reason,
  confirmed,
  onReasonChange,
  onConfirmChange,
  onSubmit,
  onRetry,
}: Props) {
  return (
    <section
      aria-labelledby="remediation-title"
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
    >
      <header className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:p-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300">
            Next steps
          </p>
          <h2
            id="remediation-title"
            className="mt-1 text-lg font-semibold text-slate-100"
          >
            Remediation proposals
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-400">
            Choose an action for the assessed field. Policy-approved Tier 2
            actions execute after submission; Tier 3 deletion waits for human
            approval.
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <p className="text-[10px] text-slate-500">Proposal target</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-200">
            {object}.{field}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {custom ? "Custom field" : "Standard field"}
          </p>
        </div>
      </header>
      <div className="space-y-5 p-4 sm:p-5">
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200"
          >
            <span>Unable to load available actions: {error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-rose-400/30 px-3 py-2 font-semibold"
            >
              Retry actions
            </button>
          </div>
        )}
        <label className="block rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-200">
              Reason for the change{" "}
              <span className="font-normal text-slate-500">· Optional</span>
            </span>
            <span className="tabular-nums text-slate-500">
              {reason.length}/500
            </span>
          </span>
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={submitting !== null}
            placeholder="Explain the business reason and any review already completed…"
            className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-400 disabled:opacity-50"
          />
          <span className="mt-2 block text-[11px] leading-5 text-slate-500">
            This context is attached to whichever proposal you submit below.
          </span>
        </label>
        <div className="grid items-stretch gap-4 xl:grid-cols-3">
          {actions.map((action) => {
            const tool = tools.find((item) => item.tool_id === action.id);
            const deletion = action.id === "salesforce_delete_field";
            const unavailable =
              !tool ||
              ((!custom || !field.endsWith("__c")) &&
                action.id !== "salesforce_backup_field_def") ||
              (deletion &&
                (!field.endsWith("__c") || field.slice(0, -3).includes("__")));
            const disabled =
              unavailable ||
              loading ||
              submitting !== null ||
              (deletion && !confirmed);
            return (
              <article
                key={action.id}
                className={`flex min-w-0 flex-col rounded-xl border bg-slate-950/40 p-4 ${deletion ? "border-rose-400/20" : "border-slate-800"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-xl p-2.5 ${action.tint} ${action.color}`}
                  >
                    <action.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                    {loading ? "Loading…" : (tool?.tier ?? "Unavailable")}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-100">
                  {action.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {action.description}
                </p>
                <p className="mb-4 mt-3 text-[11px] leading-5 text-slate-500">
                  {action.detail}
                </p>
                {deletion && custom && tool && !unavailable && (
                  <label className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-400/15 bg-rose-500/5 p-3 text-xs leading-5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) =>
                        onConfirmChange(event.target.checked)
                      }
                      disabled={submitting !== null}
                      className="mt-1 shrink-0 accent-rose-400"
                    />
                    <span>
                      I intend to delete this field and understand that its
                      metadata backup cannot restore its data. Human approval is
                      required.
                    </span>
                  </label>
                )}
                <div className="mt-auto">
                  <p
                    className={`mb-3 text-[11px] ${unavailable ? "text-slate-500" : action.color}`}
                  >
                    {loading
                      ? "Checking registered actions…"
                      : !tool
                        ? "This action is not registered."
                        : unavailable
                          ? "Available only for eligible custom fields."
                          : deletion
                            ? confirmed
                              ? "Ready to request human review"
                              : "Confirm deletion intent to continue"
                            : "Policy evaluated on submission"}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSubmit(action.id, action.label)}
                    className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold transition hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40 ${action.color} ${action.tint}`}
                  >
                    {submitting === action.id ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Submitting…
                      </>
                    ) : (
                      <>
                        {action.label}
                        <ArrowRight
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
