"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";

export interface Dependency {
  id: string;
  referenceComponent: string;
  type: string;
  impactArea: string;
  referenceContext: string;
}

interface DependentTableProps {
  dependencies: Dependency[];
  onRowClick?: (dep: Dependency) => void;
}

export default function DependentTable({
  dependencies,
  onRowClick,
}: DependentTableProps) {
  const [typeFilter, setTypeFilter] = useState("All types");
  const [query, setQuery] = useState("");
  const types = useMemo(
    () => ["All types", ...Array.from(new Set(dependencies.map((item) => item.type)))],
    [dependencies],
  );
  const filteredDependencies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dependencies.filter((dependency) => {
      const matchesType =
        typeFilter === "All types" || dependency.type === typeFilter;
      const matchesQuery =
        !normalizedQuery ||
        `${dependency.referenceComponent} ${dependency.type} ${dependency.impactArea} ${dependency.referenceContext}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [dependencies, query, typeFilter]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">
                Dependency references
              </h2>
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-blue-200">
                {dependencies.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Code and metadata components that reference the selected field.
            </p>
          </div>
          <label className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter references…"
              aria-label="Filter dependency references"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />
          </label>
        </div>

        {types.length > 2 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {types.map((type) => {
              const count =
                type === "All types"
                  ? dependencies.length
                  : dependencies.filter((item) => item.type === type).length;
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    active
                      ? "border-blue-400/30 bg-blue-500/10 text-blue-200"
                      : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  {type}
                  <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {filteredDependencies.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <span className="mb-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-3 text-emerald-300">
            <AlertCircle className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-medium text-slate-200">
            {dependencies.length === 0
              ? "No dependencies found"
              : "No matching references"}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            {dependencies.length === 0
              ? "The completed scan did not find references to this field in the scanned Salesforce components."
              : "Try a different search term or reference type."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden max-h-[23rem] w-full overflow-y-auto overscroll-contain md:block">
            <table className="w-full table-fixed border-separate border-spacing-0 text-left">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
                <col className="w-[42%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Component", "Type", "Impact area", "Reference context"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className={`sticky top-0 z-10 bg-slate-950 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 first:pl-4 last:pr-4 sm:px-4 ${heading === "Type" ? "whitespace-nowrap" : ""}`}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredDependencies.map((dependency) => (
                  <tr
                    key={dependency.id}
                    onClick={() => onRowClick?.(dependency)}
                    className={`transition-colors hover:bg-slate-800/30 ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    <td className="break-words [overflow-wrap:anywhere] px-3 py-3 pl-4 text-xs font-medium text-slate-200 sm:px-4">
                      {dependency.referenceComponent}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 sm:px-4">
                      <TypeBadge type={dependency.type} />
                    </td>
                    <td className="break-words [overflow-wrap:anywhere] px-3 py-3 text-xs text-slate-400 sm:px-4">
                      {dependency.impactArea}
                    </td>
                    <td
                      className="break-words [overflow-wrap:anywhere] px-3 py-3 pr-4 text-xs text-slate-500 sm:px-4"
                      title={dependency.referenceContext}
                    >
                      {dependency.referenceContext}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="max-h-[70vh] divide-y divide-slate-800 overflow-y-auto overscroll-contain md:hidden">
            {filteredDependencies.map((dependency) => (
              <li
                key={dependency.id}
                onClick={() => onRowClick?.(dependency)}
                className={`space-y-3 p-4 ${onRowClick ? "cursor-pointer hover:bg-slate-800/30" : ""}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-xs font-semibold text-slate-200 [overflow-wrap:anywhere]">
                    {dependency.referenceComponent}
                  </p>
                  <TypeBadge type={dependency.type} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <MobileField label="Impact area" value={dependency.impactArea} />
                  <div className="col-span-2">
                    <MobileField label="Reference context" value={dependency.referenceContext} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {filteredDependencies.length > 0 && (
        <footer className="border-t border-slate-800 px-4 py-2.5 text-[10px] text-slate-600 sm:px-5">
          Showing {filteredDependencies.length} of {dependencies.length} references
        </footer>
      )}
    </section>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-[10px] font-medium text-slate-300">
      {type.replaceAll("LightningComponentBundle", "LWC")}
    </span>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-1 break-words text-slate-400">{value}</p>
    </div>
  );
}
