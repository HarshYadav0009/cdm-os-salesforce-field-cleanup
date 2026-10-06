"use client";

import { Search } from "lucide-react";
import type { ObjectTypeFilter } from "./ObjectSelectionPage";

interface SelectAreaProps {
  search: string;
  onSearchChange: (v: string) => void;
  objectType: ObjectTypeFilter;
  onObjectTypeChange: (v: ObjectTypeFilter) => void;
}

export default function SelectArea({
  search,
  onSearchChange,
  objectType,
  onObjectTypeChange,
}: SelectAreaProps) {
  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* Row 1: title + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <h2 className="whitespace-nowrap text-sm font-bold uppercase sm:text-base">
          Select Objects for Analysis
        </h2>

        <div className="flex w-full items-center rounded-lg border border-slate-600 px-2 lg:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search objects (e.g., Account, Contact…)"
            className="w-full flex-1 bg-transparent p-2 text-sm outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Row 2: helper text + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-prose text-xs text-slate-400 sm:text-sm">
          Choose one or more Salesforce SObjects to scan for unused fields via
          FieldSpy.
        </p>

        <div className="flex items-center gap-2 sm:shrink-0">
          <label
            htmlFor="objectType"
            className="whitespace-nowrap text-xs text-slate-300 sm:text-sm"
          >
            Object Type:
          </label>
          <select
            id="objectType"
            value={objectType}
            onChange={(e) =>
              onObjectTypeChange(e.target.value as ObjectTypeFilter)
            }
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="custom">Custom</option>
            <option value="standard">Standard</option>
          </select>
        </div>
      </div>
    </div>
  );
}