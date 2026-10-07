"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

interface FieldAnalysis {
  usage: SalesforceFieldUsage;
  references: SalesforceReferenceScan;
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
      const [usage, references] = await Promise.all([
        SalesforceAPI.fieldUsage(object, field),
        SalesforceAPI.scanReferences(object, field),
      ]);
      setAnalysis({ usage, references });
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : `Unable to analyze ${object}.${field}.`,
      );
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

            {analysisError && (
              <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-200">
                Analysis failed: {analysisError}
              </p>
            )}

            {analysis ? (
              <DependentTable dependencies={dependencies} />
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
