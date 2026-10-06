"use client";

import { Bell, CircleUserRound, Menu } from "lucide-react";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";

interface HeadProps {
  /** Shows the hamburger toggle on mobile/tablet (< lg) */
  onOpenNav?: () => void;
  /** Full app title — abbreviates on mobile */
  title?: string;
  shortTitle?: string;
  userName?: string;
  notificationCount?: number;
  onBellClick?: () => void;
  onUserClick?: () => void;
}

export default function Head({
  onOpenNav,
  title = "CDM-OS Guardian & Governance",
  shortTitle = "CDM-OS",
  userName = "Sumit",
  notificationCount = 0,
  onBellClick,
  onUserClick,
}: HeadProps) {
  const { status } = useRealtime();

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-[#0D1C42] px-3 py-2 sm:px-4 sm:py-3">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="shrink-0 rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-800/60 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Title — short on mobile, full on md+ */}
      <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-100 sm:text-base">
        <span className="md:hidden">{shortTitle}</span>
        <span className="hidden md:inline">{title}</span>
      </h1>
      <span className="hidden items-center gap-2 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 sm:flex">
        <span className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-slate-500"}`} />
        Live {status}
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