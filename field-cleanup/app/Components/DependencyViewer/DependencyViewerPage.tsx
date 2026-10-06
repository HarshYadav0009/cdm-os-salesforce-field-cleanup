"use client";

import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import FieldSelectSection from "./FieldSelectSection";
import DependentTable, { type Dependency } from "./DependentTable";
import DetailSection, { type FieldDetail } from "./DeatailSection";
import { useToast } from "@/app/Components/Toast/useToast";

/* ---- Data source: swap with fetch/API later ---- */
const OBJECT_FIELDS: Record<string, string[]> = {
  Account: ["Name", "Industry", "AnnualRevenue", "Phone", "Website"],
  Contact: ["FirstName", "LastName", "Email", "Phone", "AccountId"],
  Opportunity: ["Name", "StageName", "Amount", "CloseDate", "AccountId"],
  Lead: ["FirstName", "LastName", "Company", "Status", "Email"],
  Case: ["Subject", "Status", "Priority", "Origin", "ContactId"],
  CustomObject__c: ["Field1__c", "Field2__c", "Field3__c"],
};

const DEPENDENCIES: Dependency[] = [
  {
    id: "d1",
    referenceComponent: "AccountTriggerHandler.cls",
    type: "Apex Class",
    impactArea: "Business Logic",
    referenceContext: "Method: afterUpdate",
  },
  {
    id: "d2",
    referenceComponent: "AccountTriggerHandler.cls",
    type: "Apex Class",
    impactArea: "Business Logic",
    referenceContext: "Method: afterUpdate",
  },
  {
    id: "d3",
    referenceComponent: "NewAccountAutoCleanup",
    type: "Apex Class",
    impactArea: "Business Logic",
    referenceContext: "Method: afterUpdate",
  },
];

const AGENT_LOGS: string[] = [
  "Agent searching `dependencies`...\n(salesforce_mcp: `search_apex`, fieldpro_mcp: `get_references`)",
  "Agent searching `dependencies`...\n(salesforce_mcp: `search_apex`, fieldpro_mcp: `get_references`)",
];

export default function DependencyViewerPage() {
  const [object, setObject] = useState("Account");
  const [field, setField] = useState("Name");

  const toast = useToast();

  const fields = useMemo(() => OBJECT_FIELDS[object] ?? [], [object]);

  const handleObjectChange = (next: string) => {
    setObject(next);
    setField(""); // reset field when object changes
  };

  const detail: FieldDetail = {
    fieldLabel: `${object}: ${field || "—"}`,
    dataType: "Text",
    usagePercent: 0.1,
    recordsPopulated: "10 / 100,000",
    totalReferences: DEPENDENCIES.length,
    highRiskDependencies: 2,
    logs: AGENT_LOGS,
  };

  const handleAnalyze = () => {
    if (!field) {
      toast.error("Please select a field first.", "Missing selection");
      return;
    }
    toast.promise(
      Promise.resolve({ ok: true }), // replace with fetch("/api/analyze", …)
      {
        loading: `Analyzing ${object}.${field}…`,
        success: `Analysis complete for ${object}.${field}`,
        error: "Analysis failed",
      },
    );
  };

  return (
    <div className="space-y-2">
      <h1 className="p-1 text-xl font-bold sm:text-2xl">Dependency Viewer</h1>

      <div className="rounded-lg border border-slate-700 bg-slate-900">
        <PageHeader
          title="Field Reference & Dependency Map"
          description="Visualize references for selected candidate fields across Salesforce metadata."
        />

        <div className="flex flex-col gap-4 p-3 lg:flex-row lg:items-start">
          {/* Left / main column */}
          <div className="min-w-0 flex-1 space-y-4">
            <FieldSelectSection
              objectFields={OBJECT_FIELDS}
              object={object}
              field={field}
              fields={fields}
              onObjectChange={handleObjectChange}
              onFieldChange={setField}
              onAnalyze={handleAnalyze}
            />

            <DependentTable dependencies={DEPENDENCIES} />
          </div>

          {/* Right / sidebar */}
          <aside className="w-full lg:w-[340px] xl:w-[380px] lg:shrink-0">
            <DetailSection
              detail={detail}
              onGenerateReport={() => toast.info("Generating impact report…")}
              onPauseAgent={() => toast.info("Agent paused")}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
