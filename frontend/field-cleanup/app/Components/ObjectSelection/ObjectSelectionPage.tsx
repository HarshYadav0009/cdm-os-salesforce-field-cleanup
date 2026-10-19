"use client";

import { useEffect, useMemo, useState } from "react";
import ObjectTable from "./ObjectTable";
import SelectArea from "./SelectArea";
import { SalesforceAPI, type BulkScanResult } from "@/app/lib/api/salesforce";
import { ErrorNotice } from "../FieldTools/shared";

export interface SalesforceObject {
  id: string;
  name: string;
  type: "Standard" | "Custom";
  description: string;
}

export type ObjectTypeFilter = "all" | "standard" | "custom";

export default function ObjectSelectionPage() {
  const [objects, setObjects] = useState<SalesforceObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<BulkScanResult | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    SalesforceAPI.describeGlobal(controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setObjects(response.sobjects.map((item) => ({
        id: item.name, name: item.name,
        type: item.custom ? "Custom" : "Standard",
        description: item.label,
      })));
      setError(null);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load Salesforce objects.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [revision]);
  const [search, setSearch] = useState("");
  const [objectType, setObjectType] = useState<ObjectTypeFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* Filter by type + search query */
  const filteredObjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return objects.filter((o) => {
      const matchesType =
        objectType === "all" || o.type.toLowerCase() === objectType;
      const matchesSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [objects, search, objectType]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = (ids: string[], checked: boolean) => {
    setSelectedIds((previous) => checked
      ? Array.from(new Set([...previous, ...ids]))
      : previous.filter((id) => !ids.includes(id)));
  };

  const handleInitiate = async () => {
    if (selectedIds.length === 0 || scanning) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await SalesforceAPI.bulkScan([...selectedIds], 0));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to scan selected objects.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-2">
      <h1 className="p-1 text-xl font-bold sm:text-2xl">
        Object Selection Page
      </h1>

      {loading && <p role="status" className="p-3 text-sm text-slate-400">Loading Salesforce objects…</p>}
      {error && <ErrorNotice>{error}<button type="button" className="ml-3 underline" onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>Reload objects</button></ErrorNotice>}
      {scanning && <p role="status" className="p-3 text-sm text-slate-400">Scanning selected Salesforce objects…</p>}
      {result && <p role="status" className="p-3 text-sm text-slate-300">Scanned {result.total_custom_fields_scanned} fields: {result.total_candidates_found} cleanup candidates, {result.total_needs_review} need review, {result.total_active_in_use} active. Open Field Tools to review candidates and propose changes.</p>}
      <div className="rounded-lg border border-slate-700 bg-slate-900">
        <SelectArea
          search={search}
          onSearchChange={setSearch}
          objectType={objectType}
          onObjectTypeChange={setObjectType}
        />

        <ObjectTable
          objects={filteredObjects}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onInitiate={() => void handleInitiate()}
          busy={scanning || loading}
        />
      </div>
    </div>
  );
}