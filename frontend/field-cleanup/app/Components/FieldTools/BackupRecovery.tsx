"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { GovernanceAPI } from "@/app/lib/api/governance";
import { useApiResource } from "@/app/lib/api/useApiResource";
import type { Proposal } from "@/types/governance";
import {
  panel,
  input,
  button,
  secondary,
  message,
  ErrorNotice,
  JsonDetails,
  Busy,
} from "./shared";

export default function BackupRecovery() {
  const source = useApiResource<Proposal[]>(
    "/proposals/",
    [],
  );
  const [backupId, setBackupId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const backups = source.data.filter((item) => item.status === "COMPLETED")
    .flatMap((item) => {
      const result = item.execution_result;
      return result &&
        typeof result.backup_id === "string" &&
        item.tool_id !== "salesforce_rollback_field"
        ? [
            {
              id: result.backup_id,
              object: String(
                result.object_name ??
                  result.object ??
                  item.input_payload.object_name ??
                  item.input_payload.object_api_name ??
                  "",
              ),
              field: String(
                result.field_name ??
                  result.field ??
                  item.input_payload.field_name ??
                  item.input_payload.field_api_name ??
                  "",
              ),
              date: item.executed_at ?? item.created_at,
              deleted: item.tool_id === "salesforce_delete_field",
            },
          ]
        : [];
    })
    .filter(
      (backup, index, all) =>
        all.findIndex((item) => item.id === backup.id) === index,
    );
  const locked =
    busy ||
    Boolean(
      proposal &&
      [
        "EXECUTING",
        "POLICY_APPROVED",
        "HUMAN_APPROVED",
        "PENDING_HUMAN_APPROVAL",
      ].includes(proposal.status),
    );
  const proposalId = proposal?.id;
  const proposalStatus = proposal?.status;
  useEffect(() => {
    if (
      !proposalId ||
      !proposalStatus ||
      ![
        "EXECUTING",
        "POLICY_APPROVED",
        "HUMAN_APPROVED",
        "PENDING_HUMAN_APPROVAL",
      ].includes(proposalStatus)
    )
      return;
    let active = true;
    const timer = window.setInterval(() => {
      void GovernanceAPI.getProposal(proposalId)
        .then((current) => {
          if (active) {
            setProposal(current);
            setError(null);
          }
        })
        .catch((error) => {
          if (active) setError(`Unable to refresh proposal: ${message(error)}`);
        });
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [proposalId, proposalStatus]);
  async function execute(current: Proposal) {
    setBusy(true);
    setError(null);
    try {
      const execution = await GovernanceAPI.executeProposal(current.id);
      setProposal({ ...current, status: execution.status === "SUCCESS" ? "COMPLETED" : execution.status, execution_result: { ...execution.result, ...(execution.execution_id ? { execution_id: execution.execution_id } : {}) }, error_message: execution.status === "FAILED" ? execution.error_message || "Execution failed." : undefined });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!backupId.trim() || !reason.trim() || !confirmed || locked) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const created = await GovernanceAPI.createProposal({
        agent_id: "field-cleanup-agent",
        tool_id: "salesforce_rollback_field",
        input_payload: { backup_id: backupId.trim(), reason: reason.trim() },
      });
      setProposal(created);
      setConfirmed(false);
      if (["POLICY_APPROVED", "HUMAN_APPROVED"].includes(created.status)) {
        const execution = await GovernanceAPI.executeProposal(created.id);
        setProposal({ ...created, status: execution.status === "SUCCESS" ? "COMPLETED" : execution.status, execution_result: { ...execution.result, ...(execution.execution_id ? { execution_id: execution.execution_id } : {}) }, error_message: execution.status === "FAILED" ? execution.error_message || "Execution failed." : undefined });
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className={panel}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recorded backups</h2>
          <button
            className={secondary}
            disabled={source.loading}
            onClick={source.reload}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Backup IDs from the returned completed proposals. You can also enter
          an existing backup ID manually.
        </p>
        <div className="mt-4 space-y-3">
          {source.loading && <Busy label="Loading backups…" />}
          {source.error && <ErrorNotice>{source.error}</ErrorNotice>}
          {!source.loading && !source.error && !backups.length && (
            <p className="py-6 text-sm text-slate-400">
              No recorded backups. Create a metadata backup in Dependency Viewer
              first.
            </p>
          )}
          {backups.map((backup) => (
            <button
              key={backup.id}
              disabled={locked || backup.deleted}
              onClick={() => {
                setBackupId(backup.id);
                setConfirmed(false);
              }}
              className={`w-full rounded-lg border p-3 text-left disabled:opacity-50 ${backupId === backup.id ? "border-blue-400 bg-blue-500/10" : "border-white/10 hover:bg-white/5"}`}
            >
              <p className="break-words text-sm font-medium">
                {backup.object}.{backup.field}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-400">
                {backup.id}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(backup.date).toLocaleString()}
              </p>
              {backup.deleted && (
                <p className="mt-2 text-xs text-amber-300">
                  Deleted field · Metadata snapshot only. Recover through
                  Salesforce Deleted Fields.
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={`${panel} space-y-4`}>
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-4 text-sm">
          <h2 className="font-semibold text-amber-200">
            Recover a deleted field
          </h2>
          <p className="mt-2 leading-6 text-slate-300">
            In Salesforce, open Setup → Object Manager → the field’s object →
            Fields &amp; Relationships → Deleted Fields, then choose Undelete.
            Salesforce retains deleted fields and their data for up to 15 days
            unless they are permanently erased.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            The restored API name can include “_del”; verify the name and
            permissions afterward. The form below only restores descriptions for
            existing fields.
          </p>
          <a
            className="mt-3 inline-block text-xs font-semibold text-blue-300 hover:underline"
            href="https://help.salesforce.com/s/articleView?id=fields_managing_deleted_fields.htm&language=en_US&type=5"
            target="_blank"
            rel="noreferrer"
          >
            Salesforce field recovery instructions
          </a>
        </div>
        <h2 className="text-lg font-semibold">Restore a field description</h2>
        <p className="text-sm leading-relaxed text-slate-400">
          Restore the description captured in a metadata backup. Deleted fields,
          record data, and field permissions cannot be restored by this action.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void restore();
          }}
        >
          <label className="block text-sm text-slate-300">
            Backup ID
            <input
              className={`${input} mt-2`}
              required
              maxLength={200}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
              value={backupId}
              disabled={locked}
              onChange={(event) => {
                setBackupId(event.target.value);
                setConfirmed(false);
              }}
              placeholder="bak_Account_Legacy_Field__c_…"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Reason for restoring
            <textarea
              className={`${input} mt-2`}
              required
              rows={3}
              value={reason}
              disabled={locked}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why the previous description should be restored."
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              className="mt-1 accent-blue-400"
              checked={confirmed}
              disabled={locked}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I want to replace the current field description with the
              description in this backup.
            </span>
          </label>
          <button
            className={`${button} w-full`}
            disabled={
              locked || !confirmed || !backupId.trim() || !reason.trim()
            }
          >
            {busy ? (
              <Busy label="Submitting…" />
            ) : (
              "Propose description restore"
            )}
          </button>
        </form>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        {proposal && (
          <div
            aria-live="polite"
            className="rounded-lg border border-white/10 p-4 text-sm"
          >
            <p className="font-semibold">
              {proposal.status.replaceAll("_", " ")}
            </p>
            <p className="mt-1 break-all text-xs text-slate-500">
              Proposal {proposal.id}
            </p>
            {proposal.status === "PENDING_HUMAN_APPROVAL" && (
              <p className="mt-2 text-amber-300">
                Review this proposal in Approval Queue.
              </p>
            )}
            {proposal.status === "EXECUTING" && (
              <p className="mt-2 text-slate-400">
                Restoring description. Status refreshes automatically.
              </p>
            )}
            {proposal.status === "POLICY_DENIED" && (
              <p className="mt-2 text-rose-300">
                {proposal.policy_result?.denial_reasons.join(" ") ||
                  "Policy denied this restore."}
              </p>
            )}
            {proposal.error_message && (
              <p className="mt-2 text-rose-300">{proposal.error_message}</p>
            )}
            {["POLICY_APPROVED", "HUMAN_APPROVED"].includes(
              proposal.status,
            ) && (
              <button
                className={`${secondary} mt-3`}
                disabled={busy}
                onClick={() => void execute(proposal)}
              >
                Execute approved restore
              </button>
            )}
            {proposal.execution_result && (
              <>
                <p className="mt-3 whitespace-pre-wrap break-words text-slate-300">
                  Restored description:{" "}
                  {String(proposal.execution_result.restored_description ?? "")}
                </p>
                <JsonDetails value={proposal.execution_result} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
