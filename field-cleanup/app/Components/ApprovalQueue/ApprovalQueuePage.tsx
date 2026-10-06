"use client";

import { useEffect, useState } from "react";
import InfoHead from "./InfoHead";
import QueueTable, { type QueueRow } from "./QueueTable";
import RiskAssessmentModal from "./RiskAssessmentModal";
import { useToast } from "../Toast/useToast";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { GovernanceAPI } from "@/app/lib/api/governance";
import { SourceNotice } from "@/app/Components/Governance/GovernancePages";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";
import type { Proposal } from "@/types/governance";

function getPayloadValue(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function formatQueueTime(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return createdAt;

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function toQueueRow(proposal: Proposal): QueueRow {
  return {
    id: proposal.id,
    targetField:
      getPayloadValue(proposal.input_payload, [
        "field_api_name",
        "field_name",
        "target_field",
        "field",
      ]) ?? "—",
    targetName:
      getPayloadValue(proposal.input_payload, [
        "object",
        "object_name",
        "sobject",
        "target",
      ]) ?? proposal.tool_id,
    action: proposal.tool_id,
    risk: `${proposal.tier} · Human approval`,
    queueTime: formatQueueTime(proposal.created_at),
    proposal,
  };
}

export default function ApprovalQueuePage() {
  const source = useApiResource<Proposal[]>("/proposals/queue/pending", []);
  const { reload } = source;
  const { subscribe } = useRealtime();
  const rows = source.data.map(toQueueRow);
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null);
  const [initialDecision, setInitialDecision] = useState<"approve" | "reject" | undefined>();
  const toast = useToast();

  useEffect(
    () => subscribe((event) => {
      if (
        ["approval.created", "approval.updated", "proposal.created", "proposal.updated"].includes(
          event.type,
        )
      ) {
        reload();
      }
    }),
    [reload, subscribe],
  );

  const handleDecision = async (
    row: QueueRow,
    decision: "approve" | "reject",
    reviewerEmail: string,
    reason: string,
  ) => {
    try {
      await GovernanceAPI.submitDecision(
        row.id,
        decision === "approve" ? "APPROVED" : "REJECTED",
        reviewerEmail,
        reason,
      );
      source.setData((prev) => prev.filter((proposal) => proposal.id !== row.id));
      setSelectedRow(null);
      if (decision === "approve") {
        try {
          await GovernanceAPI.executeProposal(row.id);
        } catch (error) {
          toast.error(
            `Proposal was approved, but execution could not be started: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            "Execution not started",
          );
          return;
        }
        toast.success(`Approved and dispatched ${row.targetName}:${row.action}`);
      } else {
        toast.success(`Rejected ${row.targetName}:${row.action}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the approval decision.", "Decision not recorded");
    }
  };

  return (
    <div className="space-y-2">
      <h1 className="p-1 text-xl font-bold sm:text-2xl">Approval Queue Page</h1>

      <div className="rounded-lg border border-slate-700 bg-slate-900">
        <InfoHead
          title="Approval Queue Page"
          description="Review proposals that the policy engine has routed for human approval. Decisions are recorded with the reviewer and an audited reason."
        />

        <QueueTable
          rows={rows}
          onViewEvidence={(row) => {
            setInitialDecision(undefined);
            setSelectedRow(row);
          }}
          onApprove={(row) => {
            setInitialDecision("approve");
            setSelectedRow(row);
          }}
          onReject={(row) => {
            setInitialDecision("reject");
            setSelectedRow(row);
          }}
        />
      </div>
      <SourceNotice loading={source.loading} error={source.error} reload={source.reload} />

      <RiskAssessmentModal
        key={selectedRow ? `${selectedRow.id}:${initialDecision ?? "evidence"}` : "closed"}
        isOpen={selectedRow !== null}
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        initialDecision={initialDecision}
        onApprove={(row, reviewerEmail, reason) =>
          handleDecision(row, "approve", reviewerEmail, reason)
        }
        onReject={(row, reviewerEmail, reason) =>
          handleDecision(row, "reject", reviewerEmail, reason)
        }
      />
    </div>
  );
}
