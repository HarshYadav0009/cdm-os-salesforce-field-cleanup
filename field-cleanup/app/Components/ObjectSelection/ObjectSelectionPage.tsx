"use client";

import { useMemo, useState } from "react";
import ObjectTable from "./ObjectTable";
import SelectArea from "./SelectArea";

export interface SalesforceObject {
  id: string;
  name: string;
  type: "Standard" | "Custom";
  description: string;
}

export type ObjectTypeFilter = "all" | "standard" | "custom";

/* ---- Mock data (move to API/DB later) ---- */
const OBJECTS: SalesforceObject[] = [
  { id: "obj-1", name: "Opportunity",     type: "Standard", description: "Represents a potential sale to the opportunity potential sale." },
  { id: "obj-2", name: "Autobase",        type: "Standard", description: "Represents a potential sale in takensosisine." },
  { id: "obj-3", name: "CustomRaskard",   type: "Custom",   description: "Represents a potential sale to altormedia messager." },
  { id: "obj-4", name: "Contact",         type: "Standard", description: "Represents a potential account, for contact." },
  { id: "obj-5", name: "CustomObject__c", type: "Custom",   description: "Represents a potential sale to protential nopronuctive objects." },
  { id: "obj-6", name: "Contacts",        type: "Standard", description: "Represents an individual account to the opportunity-claser names." },
  { id: "obj-7", name: "CustomRiser",     type: "Custom",   description: "Represents a potential sale to contrimotor parmons." },
  { id: "obj-8", name: "Contact",         type: "Standard", description: "Represents a potential sale ontion to mait alperature-eports." },
];

export default function ObjectSelectionPage() {
  const [search, setSearch] = useState("");
  const [objectType, setObjectType] = useState<ObjectTypeFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* Filter by type + search query */
  const filteredObjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OBJECTS.filter((o) => {
      const matchesType =
        objectType === "all" || o.type.toLowerCase() === objectType;
      const matchesSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [search, objectType]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.length === filteredObjects.length
        ? []
        : filteredObjects.map((o) => o.id)
    );
  };

  const handleInitiate = () => {
    if (selectedIds.length === 0) return;
    // TODO: hook into your toast + API
    console.log("Initiate analysis for:", selectedIds);
  };

  return (
    <div className="space-y-2">
      <h1 className="p-1 text-xl font-bold sm:text-2xl">
        Object Selection Page
      </h1>

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
          onInitiate={handleInitiate}
        />
      </div>
    </div>
  );
}