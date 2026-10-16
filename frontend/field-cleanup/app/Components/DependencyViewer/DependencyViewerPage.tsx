"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RemediationProposals from "./RemediationProposals";
import FieldSelectSection from "./FieldSelectSection";
import DependentTable, { type Dependency } from "./DependentTable";
import DetailSection, { type FieldDetail } from "./DeatailSection";
import AssessmentSummary from "./AssessmentSummary";
import {
  SalesforceAPI,
  type SalesforceFieldUsage,
  type SalesforceFieldMetadata,
  type SalesforceObjectDescription,
  type SalesforceObjectSummary,
  type SalesforceReferenceScan,
} from "@/app/lib/api/salesforce";
import GovernanceAPI, { waitForExecution } from "@/app/lib/api/governance";
import { useApiResource } from "@/app/lib/api/useApiResource";
import { useToast } from "@/app/Components/Toast/useToast";
import type { Proposal, ToolDefinition } from "@/types/governance";

interface FieldAnalysis {
  usage: SalesforceFieldUsage;
  references: SalesforceReferenceScan;
  referenceScanErrors: string[];
}

const ANALYSIS_AGENT_ID = "field-cleanup-agent";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    referenceContext:
      [
        reference.line_number ? `Line ${reference.line_number}` : "",
        reference.snippet ?? reference.description ?? "",
      ]
        .filter(Boolean)
        .join(": ") || "Reference found",
  }));
}

export default function DependencyViewerPage({
  initialObject = "",
  initialField = "",
  autoAnalyze = false,
}: {
  initialObject?: string;
  initialField?: string;
  autoAnalyze?: boolean;
}) {
  const automaticAnalysisPending = useRef(autoAnalyze && !!initialObject && !!initialField);
  const selectedObjectRef = useRef(initialObject);
  const requestedFieldRef = useRef(initialField);
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [target, setTarget] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [object, setObject] = useState("");
  const [field, setField] = useState("");
  const [objectListLoading, setObjectListLoading] = useState(true);
  const [objectListError, setObjectListError] = useState<string | null>(null);
  const [objectListRevision, setObjectListRevision] = useState(0);
  const [metadata, setMetadata] = useState<SalesforceObjectDescription | null>(
    null,
  );
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataRevision, setMetadataRevision] = useState(0);
  const [assessment, setAssessment] = useState<{ object: string; field: string; response: unknown } | null>(null);
  const [analysis, setAnalysis] = useState<FieldAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [proposalReason, setProposalReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submittingToolId, setSubmittingToolId] = useState<string | null>(null);
  const toolsSource = useApiResource<ToolDefinition[]>("/tools/", []);
  const toast = useToast();
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
          ...(proposalReason.trim() ? { reason: proposalReason.trim() } : {}),
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
        alreadyPending
          ? "Already in Approval Queue"
          : "Proposal submission failed",
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
      const started = await GovernanceAPI.executeProposal(proposal.id);
      if (started.status === "EXECUTING") toast.info(`Proposal ${proposal.id} is executing. Waiting for its result.`, "Execution in progress");
      const execution = await waitForExecution(proposal.id, started);
      if (execution.status === "EXECUTING") {
        toast.info(`Proposal ${proposal.id} is still running. Check its progress in Proposals before submitting another change.`, "Execution in progress");
        return;
      }
      if (execution.status === "FAILED") throw new Error(execution.error_message || `Execution failed for proposal ${proposal.id}.`);
      toast.success(`${label} succeeded. ${execution.execution_id ? `Execution ID: ${execution.execution_id}` : `Proposal ID: ${proposal.id}`}`, "Proposal executed");
      if (typeof execution.result.warning === "string") toast.info(execution.result.warning, "Execution note");
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

  const runAnalysis = useCallback(async (objectName: string, fieldName: string, signal?: AbortSignal) => {
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const [usage, references] = await Promise.all([
        SalesforceAPI.fieldUsage(objectName, fieldName, signal),
        SalesforceAPI.scanReferences(objectName, fieldName, signal),
      ]);
      if (!signal?.aborted) setAnalysis({ usage, references, referenceScanErrors: [] });
    } catch (error) {
      if (!signal?.aborted) setAnalysisError(error instanceof Error ? error.message : `Unable to analyze ${objectName}.${fieldName}.`);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

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
        const selectedObject =
          currentObject &&
          nextObjects.some((item) => item.name === currentObject)
            ? currentObject
            : (nextObjects.find((item) => item.name === "Account")?.name ??
              nextObjects[0]?.name ??
              "");
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
      });

    return () => controller.abort();
  }, [objectListRevision]);

  useEffect(() => {
    if (!object) return;

    const controller = new AbortController();

    SalesforceAPI.describeObject(object, controller.signal)
      .then((description) => {
        if (controller.signal.aborted) return;
        setMetadata(description);
        const requestedField = requestedFieldRef.current;
        if (requestedField && !description.fields.some((item) => item.name === requestedField)) {
          setTargetError(`Field ${requestedField} was not found on ${object}.`);
        }
        setField(
          description.fields.some((item) => item.name === requestedField)
            ? requestedField
            : (description.fields[0]?.name ?? ""),
        );
        requestedFieldRef.current = "";
        if (automaticAnalysisPending.current && object === initialObject && requestedField === initialField &&
          description.fields.some((item) => item.name === initialField)) {
          automaticAnalysisPending.current = false;
          void runAnalysis(object, initialField, controller.signal);
        }
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
  }, [object, metadataRevision, initialObject, initialField, runAnalysis]);

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

    window.addEventListener(
      "salesforce-field-deleted",
      refreshAfterFieldDeletion,
    );
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
    setConfirmDelete(false);
    selectedObjectRef.current = nextObject;
    setObject(nextObject);
    setMetadata(null);
    setField("");
    setMetadataLoading(true);
    setMetadataError(null);
    setAnalysis(null);
    setAnalysisError(null);
  };

  const handleAnalyze = () => {
    if (!field || !fieldMetadata) return;
    return runAnalysis(object, field);
  };

  const detail: FieldDetail = {
    fieldLabel: fieldMetadata?.label
      ? `${metadata?.label ?? object}: ${fieldMetadata.label}`
      : `${object || "Salesforce object"}: ${field || "—"}`,
    dataType: fieldMetadata?.type ?? "—",
    metadata: fieldMetadata,
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
          Inspect field metadata, data population, and references before making
          changes.
        </p>
      </div>

      <form className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parts = target.trim().split(".");
          const nextObject = objects.find((item) => item.name === parts[0]);
          if (parts.length !== 2 || !nextObject || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(parts[1])) {
            setTargetError("Enter a valid Object.Field, such as Account.Legacy_Id__c.");
            return;
          }
          if (object === nextObject.name) {
            if (!fields.includes(parts[1])) {
              setTargetError("This field was not found on the selected object.");
              return;
            }
            setField(parts[1]);
            setAnalysis(null);
            setAnalysisError(null);
            setConfirmDelete(false);
          } else {
            requestedFieldRef.current = parts[1];
            handleObjectChange(nextObject.name);
          }
          setTargetError(null);
        }}>
        <label htmlFor="dependency-target" className="block text-sm text-slate-300">Jump to Object.Field</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="dependency-target" value={target} onChange={(event) => setTarget(event.target.value)}
            placeholder="Account.Legacy_Id__c" disabled={analysisLoading || metadataLoading || objectListLoading}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <button disabled={analysisLoading || metadataLoading || objectListLoading || !target.trim()}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">Select target</button>
        </div>
        {targetError && <p role="alert" className="mt-2 text-sm text-rose-300">{targetError}</p>}
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/10">
        <div className="min-w-0 space-y-5 p-4 sm:p-5">
          <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 text-xs sm:grid-cols-3">
            {[
              ["01", "Choose a target", "Select an object and field."],
              [
                "02",
                "Inspect the evidence",
                "Check population and references.",
              ],
              [
                "03",
                "Propose a change",
                "Review tiers and approval requirements.",
              ],
            ].map(([step, title, description]) => (
              <div key={step} className="flex min-w-0 gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 font-mono text-blue-300">
                  {step}
                </span>
                <div>
                  <p className="font-semibold text-slate-200">{title}</p>
                  <p className="mt-1 text-slate-500">{description}</p>
                </div>
              </div>
            ))}
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
                setConfirmDelete(false);
              setField(nextField);
              setAnalysis(null);
              setAnalysisError(null);
            }}
            onAnalyze={handleAnalyze}
          />
          <button type="button" disabled={!object || !field || analysisLoading || metadataLoading || objectListLoading}
            className="rounded-lg border border-blue-400/30 px-4 py-2 text-sm text-blue-300 disabled:opacity-50"
            onClick={async () => {
              setAnalysisLoading(true); setAnalysisError(null); setAssessment(null);
              try {
                const response = await SalesforceAPI.fullAssessment(object, field);
                setAssessment({ object, field, response });
              } catch (error) {
                setAnalysisError(error instanceof Error ? error.message : "Unable to load full assessment.");
              } finally { setAnalysisLoading(false); }
            }}>Run full field assessment</button>
          {assessment && assessment.object === object && assessment.field === field && <section aria-live="polite" className="rounded-xl border border-slate-800 p-4">
            <h2 className="text-sm font-semibold">Full field assessment response</h2>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">{typeof assessment.response === "string" ? assessment.response : JSON.stringify(assessment.response, null, 2)}</pre>
          </section>}


          {objectListError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-200"
            >
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
            <div
              role="alert"
              className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-200"
            >
              <p>
                Could not load fields for {object}: {metadataError}
              </p>
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

          <DetailSection detail={detail} />
          {analysis && (
            <AssessmentSummary
              object={object}
              field={field}
              population={analysis.usage.usage_percentage}
              references={analysis.references.reference_count}
              hasReferences={analysis.references.has_references}
              errors={analysis.referenceScanErrors}
              summary={analysis.references.summary}
              onExport={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          object,
                          field,
                          metadata: fieldMetadata,
                          ...analysis,
                          exported_at: new Date().toISOString(),
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                );
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${object}.${field}.assessment.json`;
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            />
          )}
          {analysis || analysisError ? (
            <>
              <DependentTable
                dependencies={dependencies}
                error={analysisError ?? undefined}
              />
              {analysis && (
                <RemediationProposals
                  object={object}
                  field={field}
                  custom={fieldMetadata?.custom === true}
                  tools={toolsSource.data}
                  loading={toolsSource.loading}
                  error={toolsSource.error}
                  submitting={submittingToolId}
                  reason={proposalReason}
                  confirmed={confirmDelete}
                  onReasonChange={setProposalReason}
                  onConfirmChange={setConfirmDelete}
                  onRetry={toolsSource.reload}
                  onSubmit={(toolId, label) =>
                    void submitFieldProposal(toolId, label)
                  }
                />
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
                    Checking record population and Salesforce code and metadata
                    references.
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
                    Choose a field above and run an analysis to see its live
                    references.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
