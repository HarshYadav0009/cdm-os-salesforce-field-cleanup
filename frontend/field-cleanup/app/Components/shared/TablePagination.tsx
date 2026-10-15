"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const TABLE_PAGE_SIZE = 15;

export function useTablePagination<T>(rows: T[]) {
  // Preserve the page across polling updates; restart when the row set/order changes.
  const key = JSON.stringify(rows.map((row) => {
    const value = row as Record<string, unknown>;
    return value.id ?? value.tool_id ?? (value.object && value.field ? `${value.object}.${value.field}` : row);
  }));
  const [selection, setSelection] = useState({ key, page: 0 });
  const pageCount = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const page = selection.key === key ? Math.min(selection.page, pageCount - 1) : 0;
  const onPageChange = (next: number) => setSelection({ key, page: Math.max(0, Math.min(next, pageCount - 1)) });
  return {
    visibleRows: rows.slice(page * TABLE_PAGE_SIZE, (page + 1) * TABLE_PAGE_SIZE),
    page,
    pageCount,
    total: rows.length,
    onPageChange,
  };
}

export default function TablePagination({ page, pageCount, total, onPageChange, label = "Table pagination" }: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const start = total ? page * TABLE_PAGE_SIZE + 1 : 0;
  const end = Math.min((page + 1) * TABLE_PAGE_SIZE, total);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 px-4 py-3">
      <p aria-live="polite" className="text-xs tabular-nums text-slate-400">Showing {start}–{end} of {total}</p>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" /> Previous
        </button>
        <span className="whitespace-nowrap text-xs tabular-nums text-slate-400">Page {page + 1} of {pageCount}</span>
        <button type="button" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
          Next <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
