"use client";

import type { SalesforceObject } from "./ObjectSelectionPage";

interface ObjectTableProps {
  objects: SalesforceObject[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onInitiate: () => void;
}

export default function ObjectTable({
  objects,
  selectedIds,
  onToggle,
  onToggleAll,
  onInitiate,
}: ObjectTableProps) {
  const allChecked =
    objects.length > 0 && selectedIds.length === objects.length;
  const someChecked =
    selectedIds.length > 0 && selectedIds.length < objects.length;
  const noSelection = selectedIds.length === 0;

  return (
    <div className="rounded-lg bg-slate-900 text-slate-200">
      {/* Scrollable area — responsive height */}
      <div className="max-h-[55vh] overflow-auto sm:max-h-[60vh] lg:max-h-[29rem]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-700">
            <tr className="border-b border-slate-700">
              <th className="w-12 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={onToggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 cursor-pointer accent-blue-500"
                />
              </th>
              <th className="px-3 py-3 text-left font-semibold">Object Name</th>
              <th className="px-3 py-3 text-left font-semibold">Object Type</th>
              <th className="px-3 py-3 text-left font-semibold">Description</th>
            </tr>
          </thead>

          <tbody>
            {objects.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-slate-400"
                >
                  No objects match your search.
                </td>
              </tr>
            )}

            {objects.map((obj) => (
              <tr
                key={obj.id}
                className="border-b border-slate-800 transition-colors last:border-0 hover:bg-slate-800/50"
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(obj.id)}
                    onChange={() => onToggle(obj.id)}
                    aria-label={`Select ${obj.name}`}
                    className="h-4 w-4 cursor-pointer accent-blue-500"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3">{obj.name}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      obj.type === "Custom"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-sky-500/20 text-sky-300",
                    ].join(" ")}
                  >
                    {obj.type}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-300">{obj.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Action */}
      <div className="flex flex-col items-stretch gap-2 border-t border-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400 sm:text-sm">
          {selectedIds.length} of {objects.length} selected
        </p>
        <button
          onClick={onInitiate}
          disabled={noSelection}
          className={[
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            noSelection
              ? "cursor-not-allowed bg-slate-700 text-slate-400"
              : "cursor-pointer bg-blue-400 text-slate-900 hover:bg-blue-300",
          ].join(" ")}
        >
          INITIATE FIELD USAGE ANALYSIS
        </button>
      </div>
    </div>
  );
}
