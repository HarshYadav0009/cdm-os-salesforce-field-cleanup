"use client";

import { Calendar, Filter, Search } from "lucide-react";
import AuditLogTable from "./AuditLogTable";
import AuditFooterInfo from "./AuditFooterInfo";
import type { AuditInfoCard, AuditLog } from "./types";

interface AuditHeadSectionProps {
  title?: string;
  description?: string;

  /* Controls */
  search: string;
  onSearchChange: (v: string) => void;
  dateRange: string;
  onDateRangeChange: (v: string) => void;
  agentFilter: string;
  onAgentFilterChange: (v: string) => void;

  /* Table */
  logs: AuditLog[];
  sortAsc: boolean;
  onToggleSort: () => void;
  onViewDetails: (log: AuditLog) => void;

  /* Footer */
  infoCards: AuditInfoCard[];
}

export default function AuditHeadSection({
  title = "Cryptographically Verified Audit Trail",
  description = "Audit events returned by the control plane, including their HMAC signatures. Signature verification is not exposed by the current API.",
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  agentFilter,
  onAgentFilterChange,
  logs,
  sortAsc,
  onToggleSort,
  onViewDetails,
  infoCards,
}: AuditHeadSectionProps) {
  return (
    <div className="w-full rounded-xl border border-slate-800/60 bg-slate-900 p-4 font-sans shadow-sm sm:p-6">
      {/* Header */}
      <header className="mb-4 space-y-1 sm:mb-6">
        <h2 className="text-lg font-medium leading-tight text-slate-100 sm:text-[22px]">
          {title}
        </h2>
        <p className="max-w-prose text-xs text-slate-300 sm:text-sm">
          {description}
        </p>
      </header>

      {/* Controls — stack on mobile, 3-up on md+ */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 md:grid-cols-3">
        <label className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={dateRange}
            onChange={(event) => onDateRangeChange(event.target.value)}
            aria-label="Timestamp range"
            className="w-full appearance-none rounded-lg border border-slate-700/60 bg-[#22252e] py-2 pl-9 pr-3 text-[13px] text-slate-200 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All dates</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>

        <InputWithIcon
          value={search}
          onChange={onSearchChange}
          placeholder="Search Logs"
          icon={<Search className="h-4 w-4 text-slate-400" />}
          ariaLabel="Search logs"
          iconSide="left"
        />

        <InputWithIcon
          value={agentFilter}
          onChange={onAgentFilterChange}
          placeholder="Filter by agent or action"
          icon={<Filter className="h-4 w-4 text-slate-400" />}
          ariaLabel="Filter by agent or action"
        />
      </div>

      {/* Table + Footer */}
      <div className="w-full space-y-4">
        <AuditLogTable
          logs={logs}
          sortAsc={sortAsc}
          onToggleSort={onToggleSort}
          onViewDetails={onViewDetails}
        />

        <AuditFooterInfo cards={infoCards} />
      </div>
    </div>
  );
}

/* ───────── Reusable input with trailing/leading icon ───────── */

interface InputWithIconProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  ariaLabel: string;
  iconSide?: "left" | "right";
}

function InputWithIcon({
  value,
  onChange,
  placeholder,
  icon,
  ariaLabel,
  iconSide = "right",
}: InputWithIconProps) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={[
          "w-full rounded-lg border border-slate-700/60 bg-[#22252e] py-2 text-[13px] text-slate-200",
          "transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
          iconSide === "right" ? "pl-3 pr-10" : "pl-9 pr-3",
        ].join(" ")}
      />
      <div
        className={[
          "pointer-events-none absolute inset-y-0 flex items-center",
          iconSide === "right" ? "right-0 pr-3" : "left-0 pl-3",
        ].join(" ")}
      >
        {icon}
      </div>
    </div>
  );
}