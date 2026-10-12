"use client";

import { useEffect, useState } from "react";
import { Boxes, RotateCcw, Wrench, RefreshCw } from "lucide-react";
import {
  SalesforceAPI,
  type SalesforceObjectSummary,
  type GatewayTool,
} from "@/app/lib/api/salesforce";
import { secondary, message, ErrorNotice, Busy } from "./shared";
import BulkScan from "./BulkScan";
import BackupRecovery from "./BackupRecovery";
import ToolCatalog from "./ToolCatalog";

const tabs = [
  { id: "scan", label: "Bulk scan", icon: Boxes },
  { id: "recovery", label: "Backup recovery", icon: RotateCcw },
  { id: "tools", label: "Tool catalog", icon: Wrench },
] as const;

export default function FieldToolsPage({
  onInspect,
}: {
  onInspect?: (object: string, field: string) => void;
}) {
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["id"]>("scan");
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [tools, setTools] = useState<GatewayTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      SalesforceAPI.describeGlobal(controller.signal),
      SalesforceAPI.listTools(controller.signal),
    ]).then(([objectsResult, toolsResult]) => {
      if (controller.signal.aborted) return;
      const errors: string[] = [];
      if (objectsResult.status === "fulfilled")
        setObjects(objectsResult.value.sobjects);
      else errors.push(message(objectsResult.reason));
      if (toolsResult.status === "fulfilled") setTools(toolsResult.value.tools);
      else errors.push(message(toolsResult.reason));
      setError(errors.length ? errors.join(" ") : null);
      setLoading(false);
    });
    return () => controller.abort();
  }, [revision]);
  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Salesforce workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">Field Tools</h1>
          <p className="mt-2 text-sm text-slate-400">
            Scan multiple objects and manage backups. Review individual fields
            in Dependency Viewer.
          </p>
        </div>
        <button
          className={secondary}
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh catalog
        </button>
      </header>
      <div
        className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-900 p-2 sm:grid-cols-3"
        role="tablist"
        aria-label="Field tools"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`field-tools-${tab.id}`}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            aria-selected={activeTab === tab.id}
            aria-controls={`field-tools-panel-${tab.id}`}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown")
                next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
                next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              setActiveTab(tabs[next].id);
              document.getElementById(`field-tools-${tabs[next].id}`)?.focus();
            }}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-300 ${activeTab === tab.id ? "bg-blue-500/15 text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>
      {loading && <Busy label="Loading Salesforce objects and tools…" />}
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`field-tools-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`field-tools-${tab.id}`}
          hidden={activeTab !== tab.id}
        >
          {tab.id === "scan" && (
            <BulkScan
              objects={objects}
              onInspect={(object, field) => onInspect?.(object, field)}
            />
          )}
          {tab.id === "recovery" && <BackupRecovery />}
          {tab.id === "tools" && <ToolCatalog tools={tools} />}
        </div>
      ))}
    </section>
  );
}
