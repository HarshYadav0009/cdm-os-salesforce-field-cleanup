"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Loader2, ShieldAlert, WandSparkles } from "lucide-react";
import FieldSelectSection from "./FieldSelectSection";
import DependentTable, { type Dependency } from "./DependentTable";
import DetailSection, { type FieldDetail } from "./DeatailSection";
import {
  SalesforceAPI,
  type SalesforceFieldUsage,
  type SalesforceFieldMetadata,
  type SalesforceObjectDescription,
  type SalesforceObjectSummary,
  type SalesforceReferenceScan,
} from "@/app/lib/api/salesforce";
import GovernanceAPI from "@/app/lib/api/governance";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { useToast } from "@/app/Components/Toast/useToast";
import type { Proposal, ToolDefinition } from "@/types/governance";

interface FieldAnalysis {
  usage: SalesforceFieldUsage;
  references: SalesforceReferenceScan;
}

const ANALYSIS_AGENT_ID = "field-cleanup-agent";
const PROPOSAL_POLL_INTERVAL_MS = 500;
const PROPOSAL_POLL_ATTEMPTS = 90;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSalesforceFieldUsage(
  value: unknown,
): value is SalesforceFieldUsage {
  return (
    isRecord(value) &&
    typeof value.object === "string" &&
    typeof value.field === "string" &&
    typeof value.total_records === "number" &&
    typeof value.populated_records === "number" &&
    typeof value.usage_percentage === "number" &&
    typeof value.zero_usage_candidate === "boolean" &&
    typeof value.recommendation_hint === "string"
  );
}

function isSalesforceReferenceScan(
  value: unknown,
): value is SalesforceReferenceScan {
  return (
    isRecord(value) &&
    typeof value.has_references === "boolean" &&
    typeof value.reference_count === "number" &&
    typeof value.summary === "string" &&
    Array.isArray(value.all_references) &&
    value.all_references.every((reference) => {
      if (!isRecord(reference) || typeof reference.type !== "string") {
        return false;
      }
      return (
        (reference.id === undefined || typeof reference.id === "string") &&
        (reference.name === undefined || typeof reference.name === "string") &&
        (reference.line_number === undefined ||
          typeof reference.line_number === "number") &&
        (reference.snippet === undefined ||
          typeof reference.snippet === "string") &&
        (reference.description === undefined ||
          typeof reference.description === "string")
      );
    })
  );
}

function getUsageResult(proposal: Proposal): SalesforceFieldUsage {
  const result = proposal.execution_result;
  if (!isSalesforceFieldUsage(result)) {
    throw new Error("The field-usage proposal returned an invalid result.");
  }
  return result;
}

function getReferenceResult(proposal: Proposal): SalesforceReferenceScan {
  const result = proposal.execution_result;
  if (!isSalesforceReferenceScan(result)) {
    throw new Error("The reference-scan proposal returned an invalid result.");
  }
  return result;
}

async function executeAnalysisProposal(
  toolId: string,
  objectName: string,
  fieldName: string,
): Promise<Proposal> {
  const proposal = await GovernanceAPI.createProposal({
    agent_id: ANALYSIS_AGENT_ID,
    tool_id: toolId,
    input_payload: { object_name: objectName, field_name: fieldName },
  });

  if (proposal.status !== "POLICY_APPROVED") {
    throw new Error(
      `${toolId} proposal was not approved for automatic execution (${proposal.status}).`,
    );
  }

  await GovernanceAPI.executeProposal(proposal.id);
  for (let attempt = 0; attempt < PROPOSAL_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, PROPOSAL_POLL_INTERVAL_MS),
    );
    const current = await GovernanceAPI.getProposal(proposal.id);
    if (current.status === "COMPLETED") return current;
    if (current.status === "FAILED") {
      throw new Error(current.error_message || `${toolId} proposal execution failed.`);
    }
    if (current.status !== "EXECUTING") {
      throw new Error(
        `${toolId} proposal entered an unexpected state (${current.status}).`,
      );
    }
  }

  throw new Error(`${toolId} proposal did not finish before the wait timed out.`);
}

function toDependencies(references: SalesforceReferenceScan): Dependency[] {
  return references.all_references.map((reference, index) => ({
    id: `${reference.type}-${reference.id ?? reference.name ?? index}-${reference.line_number ?? index}`,
    referenceComponent: reference.name ?? reference.id ?? reference.type,
    type: reference.type,
    impactArea:
      reference.type === "Flow"
        ? "Automation"
        : reference.type === "LightningComponentBundle"
          ? "User Interface"
          : "Business Logic",
    referenceContext: [
      reference.line_number ? `Line ${reference.line_number}` : "",
      reference.snippet ?? reference.description ?? "",
    ]
      .filter(Boolean)
      .join(": ") || "Reference found",
  }));
}

export default function DependencyViewerPage() {
  const selectedObjectRef = useRef("");
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [object, setObject] = useState("");
  const [field, setField] = useState("");
  const [objectListLoading, setObjectListLoading] = useState(true);
  const [objectListError, setObjectListError] = useState<string | null>(null);
  const [objectListRevision, setObjectListRevision] = useState(0);
  const [metadata, setMetadata] = useState<SalesforceObjectDescription | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataRevision, setMetadataRevision] = useState(0);
  const [analysis, setAnalysis] = useState<FieldAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [proposalReason, setProposalReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submittingToolId, setSubmittingToolId] = useState<string | null>(null);
  const toolsSource = useApiResource<ToolDefinition[]>("/tools/", []);
  const toast = useToast();
  const proposalTools = [
    {
      toolId: "salesforce_backup_field_def",
      label: "Propose metadata backup",
      description: "Create a Tier 2 proposal to snapshot this field.",
      icon: Archive,
      tone: "border-blue-500/25 bg-blue-500/[0.06] text-blue-200 hover:bg-blue-500/10",
    },
    {
      toolId: "salesforce_deprecate_field",
      label: "Propose deprecation",
      description: "Submit a controlled field deprecation proposal.",
      icon: WandSparkles,
      tone: "border-amber-500/25 bg-amber-500/[0.06] text-amber-200 hover:bg-amber-500/10",
    },
    {
      toolId: "salesforce_delete_field",
      label: "Request deletion review",
      description: "Create a Tier 3 proposal for human review.",
      icon: ShieldAlert,
      tone: "border-rose-500/25 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/10",
    },
  ] as const;

  const submitFieldProposal = async (toolId: string, label: string) => {
    if (!object || !field || submittingToolId) return;
    if (toolId === "salesforce_delete_field" && !confirmDelete) {
      toast.error(
        "Confirm that you intend to permanently delete this custom field before submitting.",
        "Deletion confirmation required",
      );
      return;
    }
    setSubmittingToolId(toolId);
    let proposal: Proposal;
    try {
      proposal = await GovernanceAPI.createProposal({
        agent_id: ANALYSIS_AGENT_ID,
        tool_id: toolId,
        input_payload: {
          object_name: object,
          field_name: field,
          field_api_name: field,
          ...(proposalReason.trim()
            ? { reason: proposalReason.trim() }
            : {}),
          ...(toolId === "salesforce_delete_field"
            ? { confirm_delete: true }
            : {}),
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unable to submit ${label.toLowerCase()}.`;
      const alreadyPending = errorMessage.includes(
        "already present in the Approval Queue",
      );
      toast.error(
        errorMessage,
        alreadyPending ? "Already in Approval Queue" : "Proposal submission failed",
      );
      setSubmittingToolId(null);
      return;
    }

    setProposalReason("");
    if (toolId === "salesforce_delete_field") setConfirmDelete(false);

    if (proposal.status === "PENDING_HUMAN_APPROVAL") {
      toast.info(
        `${label} submitted for human review. Proposal ${proposal.id} is in the Approval Queue.`,
        "Approval required",
      );
      setSubmittingToolId(null);
      return;
    }
    if (proposal.status === "POLICY_DENIED") {
      toast.error(
        proposal.policy_result?.denial_reasons.join("; ") ||
          `The policy engine denied ${label.toLowerCase()}.`,
        "Proposal denied",
      );
      setSubmittingToolId(null);
      return;
    }
    if (proposal.status !== "POLICY_APPROVED") {
      toast.info(
        `${label} proposal ${proposal.id} was created with status ${proposal.status}.`,
        "Proposal created",
      );
      setSubmittingToolId(null);
      return;
    }

    try {
      await GovernanceAPI.executeProposal(proposal.id);
      for (let attempt = 0; attempt < PROPOSAL_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, PROPOSAL_POLL_INTERVAL_MS),
        );
        const current = await GovernanceAPI.getProposal(proposal.id);
        if (current.status === "COMPLETED") {
          const executionStatus =
            typeof current.execution_result?.status === "string"
              ? ` (${current.execution_result.status})`
              : "";
          toast.success(
            `${label} completed${executionStatus}. Proposal ID: ${proposal.id}`,
            "Proposal executed",
          );
          if (typeof current.execution_result?.warning === "string") {
            toast.info(current.execution_result.warning, "Deprecation note");
          }
          setSubmittingToolId(null);
          return;
        }
        if (current.status === "FAILED") {
          throw new Error(current.error_message || `${label} execution failed.`);
        }
        if (current.status !== "EXECUTING") {
          throw new Error(
            `Proposal entered an unexpected state (${current.status}).`,
          );
        }
      }
      throw new Error(
        `Execution is still running. Check proposal ${proposal.id} for its final status.`,
      );
    } catch (error) {
      toast.error(
        `Proposal ${proposal.id} was created, but execution did not complete: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "Proposal execution failed",
      );
    } finally {
      setSubmittingToolId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    SalesforceAPI.describeGlobal(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const nextObjects = result.sobjects
          .filter((item) => item.name)
          .sort((left, right) => left.name.localeCompare(right.name));
        setObjects(nextObjects);
        const currentObject = selectedObjectRef.current;
        const selectedObject = currentObject &&
          nextObjects.some((item) => item.name === currentObject)
          ? currentObject
          : nextObjects.find((item) => item.name === "Account")?.name ??
            nextObjects[0]?.name ??
            "";
        selectedObjectRef.current = selectedObject;
        setObject(selectedObject);
        setObjectListError(null);
        setObjectListLoading(false);
        if (selectedObject) {
          setMetadata(null);
          setField("");
          setMetadataLoading(true);
          setMetadataError(null);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load Salesforce objects.";
        setObjectListError(message);
        setObjectListLoading(false);
      })

    return () => controller.abort();
  }, [objectListRevision]);

  useEffect(() => {
    if (!object) return;

    const controller = new AbortController();

    SalesforceAPI.describeObject(object, controller.signal)
      .then((description) => {
        if (controller.signal.aborted) return;
        setMetadata(description);
        setField(description.fields[0]?.name ?? "");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMetadataError(
          error instanceof Error
            ? error.message
            : `Unable to load fields for ${object}.`,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetadataLoading(false);
      });

    return () => controller.abort();
  }, [object, metadataRevision]);

  useEffect(() => {
    const refreshAfterFieldDeletion = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (
        !isRecord(detail) ||
        typeof detail.objectName !== "string" ||
        detail.objectName.toLowerCase() !== object.toLowerCase()
      ) {
        return;
      }

      setMetadataLoading(true);
      setMetadataError(null);
      setAnalysis(null);
      setAnalysisError(null);
      setMetadataRevision((revision) => revision + 1);
    };

    window.addEventListener("salesforce-field-deleted", refreshAfterFieldDeletion);
    return () =>
      window.removeEventListener(
        "salesforce-field-deleted",
        refreshAfterFieldDeletion,
      );
  }, [object]);

  const fields = useMemo(
    () => metadata?.fields.map((item) => item.name) ?? [],
    [metadata],
  );
  const fieldMetadata: SalesforceFieldMetadata | null =
    metadata?.fields.find((item) => item.name === field) ?? null;
  const dependencies = useMemo(
    () => (analysis ? toDependencies(analysis.references) : []),
    [analysis],
  );

  const handleObjectChange = (nextObject: string) => {
    selectedObjectRef.current = nextObject;
    setObject(nextObject);
    setMetadata(null);
    setField("");
    setMetadataLoading(true);
    setMetadataError(null);
    setAnalysis(null);
    setAnalysisError(null);
  };

  const handleAnalyze = async () => {
    if (!field || !fieldMetadata) return;
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysisLoading(true);

    try {
      const [usageProposal, referenceProposal] = await Promise.all([
        executeAnalysisProposal(
          "salesforce_query_field_usage",
          object,
          field,
        ),
        executeAnalysisProposal(
          "salesforce_scan_apex_references",
          object,
          field,
        ),
      ]);
      const usage = getUsageResult(usageProposal);
      const references = getReferenceResult(referenceProposal);
      setAnalysis({ usage, references });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Unable to analyze ${object}.${field}.`;
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const detail: FieldDetail = {
    fieldLabel: fieldMetadata?.label
      ? `${metadata?.label ?? object}: ${fieldMetadata.label}`
      : `${object || "Salesforce object"}: ${field || "—"}`,
    dataType: fieldMetadata?.type ?? "—",
    usagePercent: analysis?.usage.usage_percentage ?? null,
    recordsPopulated: analysis
      ? `${analysis.usage.populated_records.toLocaleString()} / ${analysis.usage.total_records.toLocaleString()}`
      : null,
    totalReferences: analysis?.references.reference_count ?? 0,
    metadata: fieldMetadata,
    logs: analysis
      ? [
          `Population scan: ${analysis.usage.recommendation_hint}`,
          `Reference scan: ${analysis.references.summary}`,
        ]
      : ["Select a field and run an analysis to retrieve live usage and references."],
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
          Salesforce analysis
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Dependency Viewer
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          Inspect field metadata, data population, and references before making changes.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/10">
        <div className="min-w-0 space-y-5 p-4 sm:p-5">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-3 text-xs text-emerald-200">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span>Data is fetched directly from your Salesforce organization.</span>
            </div>

            <FieldSelectSection
              objects={objects.map((item) => item.name)}
              object={object}
              field={field}
              fields={fields}
              loadingObjects={objectListLoading}
              loadingFields={objectListLoading || metadataLoading}
              analyzing={analysisLoading}
              onObjectChange={handleObjectChange}
              onFieldChange={(nextField) => {
                setField(nextField);
                setAnalysis(null);
                setAnalysisError(null);
              }}
              onAnalyze={handleAnalyze}
            />

            {objectListError && (
              <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-200">
                <p>Could not load Salesforce objects: {objectListError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setObjectListLoading(true);
                    setObjectListError(null);
                    setObjectListRevision((revision) => revision + 1);
                  }}
                  className="mt-2 rounded border border-rose-300/30 px-2 py-1 text-xs font-semibold hover:bg-rose-500/10"
                >
                  Retry
                </button>
              </div>
            )}

            {metadataError && (
              <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-200">
                <p>Could not load fields for {object}: {metadataError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setMetadataLoading(true);
                    setMetadataError(null);
                    setMetadataRevision((revision) => revision + 1);
                  }}
                  className="mt-2 rounded border border-rose-300/30 px-2 py-1 text-xs font-semibold hover:bg-rose-500/10"
                >
                  Retry
                </button>
              </div>
            )}

            {analysis || analysisError ? (
              <>
                <DependentTable
                  dependencies={dependencies}
                  error={analysisError ?? undefined}
                />
                {analysis && (
                  <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-100">
                      Remediation proposals
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Submit an action for {object}.{field}. Policy-approved
                      Tier 2 actions execute after proposal creation; Tier 3
                      deletion requests wait for human approval.
                    </p>
                  </div>
                  <label className="mb-4 block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-300">
                      Reason for the proposed change
                      <span className="ml-1 font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <textarea
                      value={proposalReason}
                      onChange={(event) => setProposalReason(event.target.value)}
                      maxLength={500}
                      rows={2}
                      disabled={submittingToolId !== null}
                      placeholder="Add context for the reviewer…"
                      className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-blue-500 disabled:opacity-50"
                    />
                  </label>
                  {toolsSource.data.some(
                    (tool) => tool.tool_id === "salesforce_delete_field",
                  ) && (
                    <label className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs text-rose-100">
                      <input
                        type="checkbox"
                        checked={confirmDelete}
                        onChange={(event) =>
                          setConfirmDelete(event.target.checked)
                        }
                        disabled={submittingToolId !== null}
                        className="mt-0.5 accent-rose-500"
                      />
                      <span>
                        I understand that deletion is permanent and that the
                        metadata backup does not restore the field or its data.
                        The request will still require human approval.
                      </span>
                    </label>
                  )}
                  {toolsSource.error && (
                    <p role="alert" className="mb-3 text-xs text-rose-300">
                      Unable to load registered tool tiers: {toolsSource.error}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {proposalTools.map(({ toolId, label, description, icon: Icon, tone }) => {
                      const tool = toolsSource.data.find(
                        (registeredTool) => registeredTool.tool_id === toolId,
                      );
                      if (!tool) return null;
                      return (
                        <button
                          key={toolId}
                          type="button"
                          disabled={
                            submittingToolId !== null ||
                            toolsSource.loading ||
                            !fieldMetadata ||
                            (toolId === "salesforce_deprecate_field" &&
                              !fieldMetadata.custom) ||
                            (toolId === "salesforce_delete_field" &&
                              (!confirmDelete || !fieldMetadata.custom))
                          }
                          onClick={() => void submitFieldProposal(toolId, label)}
                          title={description}
                          className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
                        >
                          {submittingToolId === toolId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Icon className="h-3.5 w-3.5" />
                          )}
                          {label}
                          <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                            {tool.tier}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {fieldMetadata && !fieldMetadata.custom && (
                    <p className="mt-3 text-xs leading-5 text-amber-200/80">
                      Deprecation is available only for custom fields. Select
                      a custom field to submit this proposal.
                    </p>
                  )}
                  {toolsSource.data.some(
                    (tool) => tool.tool_id === "salesforce_delete_field",
                  ) && (
                    <p className="mt-3 text-xs leading-5 text-amber-200/80">
                      Deletion is limited to unmanaged custom fields. It creates
                      a metadata backup first, but does not archive existing
                      records or automatically restore the deleted field.
                    </p>
                  )}
                  {!toolsSource.loading && proposalTools.every(
                    ({ toolId }) =>
                      !toolsSource.data.some((tool) => tool.tool_id === toolId),
                  ) && (
                    <p className="mt-3 text-xs text-slate-500">
                      No Tier 2 or Tier 3 field-remediation tools are registered
                      by the control plane.
                    </p>
                  )}
                  </section>
                )}
              </>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-5 py-10 text-center">
                {analysisLoading ? (
                  <>
                    <span className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400" />
                    <h2 className="text-sm font-semibold text-slate-200">
                      Analyzing {object}.{field}
                    </h2>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      Checking record population and Salesforce code and metadata references.
                    </p>
                  </>
                ) : (
                  <>
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400">
                      <span className="text-lg">⌕</span>
                    </span>
                    <h2 className="text-sm font-semibold text-slate-200">
                      Ready to inspect dependencies
                    </h2>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      Choose a field above and run an analysis to see its live references.
                    </p>
                  </>
                )}
              </div>
            )}
            <DetailSection detail={detail} />
        </div>
      </div>
    </div>
  );
}
