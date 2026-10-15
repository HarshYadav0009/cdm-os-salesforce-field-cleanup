"use client";

import { useEffect, useState } from "react";
import { Bell, CircleUserRound, Menu } from "lucide-react";

type McpStatus = "checking" | "online" | "offline";

interface HeadProps {
  /** Shows the hamburger toggle on mobile/tablet (< lg) */
  onToggleNav: () => void;
  navOpen: boolean;
  /** Full app title — abbreviates on mobile */
  title?: string;
  shortTitle?: string;
  userName?: string;
  notificationCount?: number;
  onBellClick?: () => void;
  onUserClick?: () => void;
}

export default function Head({
  onToggleNav,
  navOpen,
  title = "CDM-OS Guardian & Governance",
  shortTitle = "CDM-OS",
  userName = "Sumit",
  notificationCount = 0,
  onBellClick,
  onUserClick,
}: HeadProps) {
  const [mcpStatus, setMcpStatus] = useState<McpStatus>("checking");
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    let active = true;

    const checkMcpStatus = async () => {
      try {
        const response = await fetch("/api/salesforce/health", {
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (!active) return;

        const online =
          response.ok &&
          typeof result === "object" &&
          result !== null &&
          "status" in result &&
          result.status === "online";
        setMcpStatus(online ? "online" : "offline");
        setIsMock(
          online &&
            "is_mock" in result &&
            result.is_mock === true,
        );
      } catch {
        if (!active) return;
        setMcpStatus("offline");
        setIsMock(false);
      }
    };

    void checkMcpStatus();
    const interval = window.setInterval(() => void checkMcpStatus(), 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const statusLabel =
    mcpStatus === "checking"
      ? "Checking MCP"
      : mcpStatus === "online"
        ? `MCP Online${isMock ? " (Mock)" : ""}`
        : "MCP Offline";

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-[#0D1C42] px-3 py-2 sm:px-4 sm:py-3">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onToggleNav}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
        aria-controls="main-navigation"
        className="shrink-0 rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-800/60 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Title — short on mobile, full on md+ */}
      <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-100 sm:text-base">
        <span className="md:hidden">{shortTitle}</span>
        <span className="hidden md:inline">{title}</span>
      </h1>
      <span
        role="status"
        aria-label={statusLabel}
        title={isMock ? "MCP is responding with Salesforce mock data." : statusLabel}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 sm:gap-2 sm:px-2.5 sm:text-xs"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            mcpStatus === "online"
              ? "bg-emerald-400"
              : mcpStatus === "checking"
                ? "bg-amber-400"
                : "bg-rose-400"
          }`}
        />
        {statusLabel}
      </span>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onBellClick}
          aria-label={
            notificationCount > 0
              ? `${notificationCount} notifications`
              : "Notifications"
          }
          className="relative rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-800/60"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onUserClick}
          aria-label={`Account: ${userName}`}
          className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-slate-200 transition-colors hover:bg-slate-800/60 sm:px-2"
        >
          <CircleUserRound className="h-5 w-5" />
          <span className="hidden max-w-[120px] truncate text-sm sm:inline">
            {userName}
          </span>
        </button>
      </div>
    </header>
  );
}