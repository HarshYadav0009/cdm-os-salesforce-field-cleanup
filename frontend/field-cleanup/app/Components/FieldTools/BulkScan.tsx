"use client";
import TablePagination, { useTablePagination } from "@/app/Components/shared/TablePagination";

import { useState } from "react";
import BulkProposals, { fieldKey } from "./BulkProposals";
import {
  SalesforceAPI,
  type SalesforceObjectSummary,
  type BulkScanResult,
} from "@/app/lib/api/salesforce";
import {
  panel,
  input,
  button,
  secondary,
  message,
  ErrorNotice,
  Busy,
} from "./shared";

export default function BulkScan({
  objects,
  onInspect,
}: {
  objects: SalesforceObjectSummary[];
  onInspect: (object: string, field: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkScanResult | null>(null);
  const [filter, setFilter] = useState("within");
  const [appliedThreshold, setAppliedThreshold] = useState(0);
  const [fieldSearch, setFieldSearch] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [proposalBusy, setProposalBusy] = useState(false);
  const allFields = result
    ? [...result.candidates, ...result.needs_review, ...result.active_fields]
    : [];
  const selectedRows = allFields.filter((item) =>
    selectedFields.includes(fieldKey(item)),
  );
  const visibleObjects = objects.filter((item) =>
    `${item.name} ${item.label}`.toLowerCase().includes(search.toLowerCase()),
  );
  const rows = result
    ? [
        ...result.candidates,
        ...result.needs_review,
        ...result.active_fields,
      ].filter(
        (item) =>
          (filter === "all" ||
            (filter === "within" &&
              item.usage_percentage <= appliedThreshold) ||
            item.classification === filter) &&
          `${item.object} ${item.field} ${item.label}`
            .toLowerCase()
            .includes(fieldSearch.toLowerCase()),
      )
    : [];
  const pagination = useTablePagination(rows);
  const skipped =
    result?.objects_scanned.filter(
      (name) => !Object.hasOwn(result.breakdown_by_object, name),
    ) ?? [];
  async function scan() {
    const value = Number(threshold);
    if (
      !selected.length ||
      threshold.trim() === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      setError(
        "Choose at least one object and a population threshold between 0 and 100%.",
      );
      return;
    }
    setRunning(true);
    setSelectedFields([]);
    setError(null);
    setResult(null);
    try {
      const nextResult = await SalesforceAPI.bulkScan(selected, value);
      setResult(nextResult);
      setAppliedThreshold(nextResult.threshold_percentage ?? value);
      setFilter("within");
    } catch (error) {
      setError(message(error));
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className={panel}>
        <h2 className="text-lg font-semibold">
          Find cleanup candidates across objects
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Scan custom fields for population and dependencies. Review candidates
          with a full assessment before proposing changes.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <label className="block text-sm text-slate-300">
              Search objects
              <input
                className={`${input} mt-2`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Account, Contact, custom objects…"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>{selected.length} selected</span>
              <button
                className={secondary}
                disabled={running || !visibleObjects.length}
                onClick={() =>
                  setSelected((current) =>
                    Array.from(
                      new Set([
                        ...current,
                        ...visibleObjects.map((item) => item.name),
                      ]),
                    ),
                  )
                }
              >
                Select matching
              </button>
              <button
                className={secondary}
                disabled={running || !selected.length}
                onClick={() => setSelected([])}
              >
                Clear selection
              </button>
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-white/10 p-3 sm:grid-cols-2">
              {visibleObjects.map((item) => (
                <label
                  key={item.name}
                  className="flex min-w-0 cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-blue-400"
                    disabled={running}
                    checked={selected.includes(item.name)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, item.name]
                          : current.filter((name) => name !== item.name),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {item.name}
                    </span>
                  </span>
                </label>
              ))}
              {!visibleObjects.length && (
                <p className="p-3 text-sm text-slate-400">
                  No matching objects.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">
              Maximum field population (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className={`${input} mt-2`}
                value={threshold}
                disabled={running}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>
            <p className="text-xs leading-relaxed text-slate-400">
              0% finds empty fields. Higher thresholds include fields with data.
              Bulk scans can take several minutes for large objects.
            </p>
            <button
              className={`${button} w-full`}
              disabled={running || proposalBusy || !selected.length}
              onClick={() => void scan()}
            >
              {running ? <Busy label="Scanning objects…" /> : "Run bulk scan"}
            </button>
          </div>
        </div>
      </div>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {result && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Fields scanned", result.total_custom_fields_scanned],
              ["Cleanup candidates", result.total_candidates_found],
              ["Dependencies to review", result.total_needs_review],
              ["Above maximum", result.total_active_in_use],
              ["Fields not assessed", result.total_skipped_fields ?? 0],
            ].map(([label, count]) => (
              <div key={label} className={panel}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
          {skipped.length > 0 && (
            <ErrorNotice>
              Partial scan: these objects could not be scanned:{" "}
              {skipped.join(", ")}. Their fields are absent from the results.
            </ErrorNotice>
          )}
          {Boolean(result.skipped_fields?.length) && (
            <div className={panel}>
              <h3 className="font-semibold text-amber-300">
                Fields not assessed
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Unsupported queries and failed checks were skipped. These fields
                are not cleanup candidates; their population and dependency
                status remain unverified.
              </p>
              <ul className="mt-4 space-y-3">
                {result.skipped_fields?.map((item) => (
                  <li
                    key={`${item.object}.${item.field}`}
                    className="rounded-lg border border-amber-400/20 p-3 text-sm"
                  >
                    <p className="break-words font-medium">
                      {item.object}.{item.field}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-400">
                      {item.stage}: {item.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Boolean(result.object_errors?.length) && (
            <div className={panel}>
              <h3 className="font-semibold text-amber-300">
                Object scan errors
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {result.object_errors?.map((item) => (
                  <li key={item.object} className="break-words">
                    {item.object} ({item.stage}): {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={panel}>
            <BulkProposals
              fields={selectedRows}
              busy={proposalBusy}
              onBusyChange={setProposalBusy}
              onCreated={(keys) =>
                setSelectedFields((current) =>
                  current.filter((key) => !keys.includes(key)),
                )
              }
            />
            {selectedRows.length > 0 && (
              <button
                className={`${secondary} mb-3`}
                disabled={proposalBusy}
                onClick={() => setSelectedFields([])}
              >
                Clear field selection
              </button>
            )}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Search scan results</span>
                <input
                  className={input}
                  placeholder="Search fields or objects…"
                  value={fieldSearch}
                  onChange={(event) => setFieldSearch(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">Filter classification</span>
                <select
                  className={input}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="within">
                    Within maximum (≤ {appliedThreshold}%)
                  </option>
                  <option value="all">All scanned fields</option>
                  <option value="CANDIDATE_FOR_CLEANUP">
                    Cleanup candidates
                  </option>
                  <option value="NEEDS_REVIEW_HAS_DEPENDENCIES">
                    Dependencies to review
                  </option>
                  <option value="ACTIVE_IN_USE">Active fields</option>
                </select>
              </label>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Applied maximum: {appliedThreshold}% · {rows.length} matching this
              view · Scanned {new Date(result.scan_timestamp).toLocaleString()}{" "}
              · {Object.keys(result.breakdown_by_object).length} objects
              completed
            </p>
            {(threshold.trim() === "" ||
              Number(threshold) !== appliedThreshold) && (
              <p
                role="status"
                className="mb-3 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-200"
              >
                The maximum has changed. Run bulk scan again to apply it; these
                results use {appliedThreshold}%.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs text-slate-400">
                  <tr>
                    <th scope="col" className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all visible fields"
                        disabled={proposalBusy || !pagination.visibleRows.length}
                        checked={
                          pagination.visibleRows.length > 0 &&
                          pagination.visibleRows.every((item) =>
                            selectedFields.includes(fieldKey(item)),
                          )
                        }
                        ref={(node) => {
                          if (node)
                            node.indeterminate =
                              pagination.visibleRows.some((item) =>
                                selectedFields.includes(fieldKey(item)),
                              ) &&
                              !pagination.visibleRows.every((item) =>
                                selectedFields.includes(fieldKey(item)),
                              );
                        }}
                        onChange={(event) =>
                          setSelectedFields((current) =>
                            event.target.checked
                              ? Array.from(
                                  new Set([...current, ...pagination.visibleRows.map(fieldKey)]),
                                )
                              : current.filter(
                                  (key) =>
                                    !pagination.visibleRows.some(
                                      (item) => fieldKey(item) === key,
                                    ),
                                ),
                          )
                        }
                        className="accent-blue-400"
                      />
                    </th>
                    {[
                      "Object / field",
                      "Population",
                      "References",
                      "Classification",
                    ].map((label) => (
                      <th key={label} scope="col" className="px-3 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagination.visibleRows.map((item) => (
                    <tr
                      key={`${item.object}.${item.field}`}
                      className="border-b border-white/5"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.object}.${item.field}`}
                          checked={selectedFields.includes(fieldKey(item))}
                          disabled={proposalBusy}
                          onChange={(event) =>
                            setSelectedFields((current) =>
                              event.target.checked
                                ? [...current, fieldKey(item)]
                                : current.filter(
                                    (key) => key !== fieldKey(item),
                                  ),
                            )
                          }
                          className="accent-blue-400"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{item.field}</p>
                        <p className="text-xs text-slate-500">
                          {item.object} · {item.type}
                        </p>
                        <button
                          className="mt-2 text-xs font-semibold text-blue-300 hover:underline"
                          onClick={() => onInspect(item.object, item.field)}
                        >
                          Review in Dependency Viewer
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {item.usage_percentage.toFixed(1)}%
                        <p className="text-xs text-slate-500">
                          {item.populated_records.toLocaleString()} /{" "}
                          {item.total_records.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {item.reference_count}
                        <p className="max-w-60 text-xs text-slate-500">
                          {item.reference_summary}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${item.classification === "CANDIDATE_FOR_CLEANUP" ? "bg-emerald-500/10 text-emerald-300" : item.classification === "ACTIVE_IN_USE" ? "bg-blue-500/10 text-blue-300" : "bg-amber-500/10 text-amber-300"}`}
                        >
                          {item.classification === "CANDIDATE_FOR_CLEANUP"
                            ? "Candidate"
                            : item.classification === "ACTIVE_IN_USE"
                              ? "Active"
                              : "Review dependencies"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination {...pagination} label="Bulk scan pagination" />
            {!rows.length && (
              <p className="py-8 text-center text-sm text-slate-400">
                No fields match this filter.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
