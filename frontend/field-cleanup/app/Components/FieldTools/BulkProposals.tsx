"use client";

import { useEffect, useRef, useState } from "react";
import { GovernanceAPI } from "@/app/lib/api/governance";
import { useApiResource } from "@/app/lib/api/useApiResource";
import type { BulkScanField } from "@/app/lib/api/salesforce";
import type { ToolDefinition } from "@/types/governance";
import { button, input, secondary, message, Busy } from "./shared";

const actions = [
  { id: "salesforce_backup_field_def", label: "Metadata backup" },
  { id: "salesforce_deprecate_field", label: "Deprecation" },
  { id: "salesforce_delete_field", label: "Deletion review" },
];
export const fieldKey = (field: BulkScanField) =>
  `${field.object}.${field.field}`;
interface Outcome {
  field: string;
  id?: string;
  status: string;
  error?: string;
}

export default function BulkProposals({
  fields,
  busy,
  onBusyChange,
  onCreated,
}: {
  fields: BulkScanField[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onCreated: (keys: string[]) => void;
}) {
  const tools = useApiResource<ToolDefinition[]>("/tools/", []);
  const [open, setOpen] = useState(false);
  const [toolId, setToolId] = useState(actions[0].id);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const deletion = toolId === "salesforce_delete_field";
  const ineligible =
    toolId !== "salesforce_backup_field_def" &&
    fields.some(
      (item) =>
        !item.field.endsWith("__c") ||
        (deletion && item.field.slice(0, -3).includes("__")),
    );
  const registered = tools.data.find((tool) => tool.tool_id === toolId);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  const pending = outcomes
    .filter(
      (item) =>
        item.id &&
        ["EXECUTING", "POLICY_APPROVED", "HUMAN_APPROVED"].includes(
          item.status,
        ),
    )
    .map((item) => item.id!)
    .join(",");
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const timer = window.setInterval(() => {
      void Promise.all(
        pending.split(",").map(async (id) => {
          try {
            const proposal = await GovernanceAPI.getProposal(id);
            if (active)
              setOutcomes((current) =>
                current.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        status: proposal.status,
                        error: proposal.error_message,
                      }
                    : item,
                ),
              );
          } catch (error) {
            if (active)
              setOutcomes((current) =>
                current.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        error: `Status refresh failed: ${message(error)}. Check Proposals.`,
                      }
                    : item,
                ),
              );
          }
        }),
      );
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pending]);
  async function submit() {
    if (
      busy ||
      !fields.length ||
      !registered ||
      ineligible ||
      (deletion && !confirmed)
    )
      return;
    onBusyChange(true);
    const batch = [...fields];
    const created: string[] = [];
    setOutcomes(
      batch.map((item) => ({
        field: fieldKey(item),
        status: "WAITING_TO_SUBMIT",
      })),
    );
    try {
      for (const field of batch) {
        const key = fieldKey(field);
        let id: string | undefined;
        try {
          const proposal = await GovernanceAPI.createProposal({
            agent_id: "field-cleanup-agent",
            tool_id: toolId,
            input_payload: {
              object_name: field.object,
              field_name: field.field,
              field_api_name: field.field,
              ...(reason.trim() ? { reason: reason.trim() } : {}),
              ...(deletion ? { confirm_delete: true } : {}),
            },
          });
          id = proposal.id;
          created.push(key);
          setOutcomes((current) =>
            current.map((item) =>
              item.field === key
                ? {
                    field: key,
                    id,
                    status: proposal.status,
                    error: proposal.policy_result?.denial_reasons.join("; "),
                  }
                : item,
            ),
          );
          if (proposal.status === "POLICY_APPROVED") {
            const execution = await GovernanceAPI.executeProposal(proposal.id);
            setOutcomes((current) =>
              current.map((item) =>
                item.field === key
                  ? { field: key, id, status: execution.status }
                  : item,
              ),
            );
          }
        } catch (error) {
          setOutcomes((current) =>
            current.map((item) =>
              item.field === key
                ? {
                    field: key,
                    id,
                    status: id ? "CHECK_PROPOSAL" : "SUBMISSION_FAILED",
                    error: message(error),
                  }
                : item,
            ),
          );
        }
      }
    } finally {
      onCreated(created);
      onBusyChange(false);
      setConfirmed(false);
      setOpen(false);
      triggerRef.current?.focus();
    }
  }
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-400/20 bg-blue-500/5 p-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-200">
            {fields.length} fields selected
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Create a separate governed proposal for each selected field.
          </p>
        </div>
        <button
          ref={triggerRef}
          className={button}
          disabled={!fields.length || busy}
          onClick={() => {
            setConfirmed(false);
            setOpen(true);
          }}
        >
          {busy ? <Busy label="Creating proposals…" /> : "Create proposals"}
        </button>
      </div>
      {outcomes.length > 0 && (
        <div
          aria-live="polite"
          className="rounded-xl border border-slate-700 p-3"
        >
          <p className="mb-2 text-sm font-semibold">Proposal results</p>
          <p className="mb-3 text-xs text-slate-400">
            Deletion requests awaiting approval appear in Approval Queue.
            Execution status refreshes here; all created records are available
            in Proposals.
          </p>
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {outcomes.map((item) => (
              <li key={item.field} className="break-words text-xs">
                <p className="font-semibold text-slate-200">
                  {item.field} · {item.status.replaceAll("_", " ")}
                </p>
                {item.id && (
                  <p className="mt-1 break-all text-slate-500">
                    Proposal {item.id}
                  </p>
                )}
                {item.error && (
                  <p className="mt-1 text-rose-300">{item.error}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby="bulk-proposal-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setOpen(false);
        }}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-black/70 sm:p-6"
      >
        <h2 id="bulk-proposal-title" className="text-lg font-semibold">
          Create proposals for {fields.length} fields
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Policy-approved Tier 2 actions execute after creation. Deletion
          requires human approval. Review individual fields in Dependency Viewer
          for a full assessment.
        </p>
        <ul className="my-4 max-h-36 space-y-1 overflow-y-auto rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300">
          {fields.map((item) => (
            <li key={fieldKey(item)} className="break-all">
              {fieldKey(item)} · {item.usage_percentage}% population ·{" "}
              {item.reference_count} references
            </li>
          ))}
        </ul>
        <label className="block text-sm">
          Action
          <select
            className={`${input} mt-2`}
            disabled={busy || tools.loading}
            value={toolId}
            onChange={(event) => {
              setToolId(event.target.value);
              setConfirmed(false);
            }}
          >
            {actions.map((action) => (
              <option key={action.id} value={action.id}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
        {registered && (
          <p className="mt-2 text-xs text-blue-300">
            {registered.tier} · {registered.name}
          </p>
        )}
        <label className="mt-4 block text-sm">
          Reason (optional)
          <textarea
            rows={3}
            maxLength={500}
            className={`${input} mt-2`}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Context to include in every proposal…"
          />
        </label>
        {deletion && (
          <label className="mt-4 flex items-start gap-3 rounded-lg border border-rose-400/20 p-3 text-xs leading-5">
            <input
              className="mt-1 accent-rose-400"
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I intend to delete all listed fields. The metadata backup does not
              restore fields or record data. Each deletion needs human approval.
            </span>
          </label>
        )}
        {ineligible && (
          <p role="alert" className="mt-3 text-xs text-amber-300">
            Some selected fields are not eligible for this action. Choose
            metadata backup or adjust your selection.
          </p>
        )}
        {tools.error && (
          <p role="alert" className="mt-3 text-xs text-rose-300">
            {tools.error}
          </p>
        )}
        {!tools.loading && !registered && (
          <p className="mt-3 text-xs text-amber-300">
            This action is not registered by the control plane.
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className={secondary}
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            className={button}
            disabled={
              busy ||
              tools.loading ||
              !registered ||
              ineligible ||
              !fields.length ||
              (deletion && !confirmed)
            }
            onClick={() => void submit()}
          >
            {busy ? (
              <Busy label="Creating proposals…" />
            ) : (
              `Create ${fields.length} proposals`
            )}
          </button>
        </div>
      </dialog>
    </div>
  );
}
