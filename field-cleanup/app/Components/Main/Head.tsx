"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CircleUserRound,
  Menu,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Proposal } from "@/types/governance";

type McpStatus = "checking" | "online" | "offline";
type SalesforceOrgType = "Developer" | "UAT" | "Sandbox" | "Production" | "Mock";

interface HeadProps {
  /** Shows the hamburger toggle on mobile/tablet (< lg) */
  onToggleNav: () => void;
  navOpen: boolean;
  /** Full app title — abbreviates on mobile */
  title?: string;
  shortTitle?: string;
  userName?: string;
  notificationCount?: number;
  notifications?: Proposal[];
  notificationsLoading?: boolean;
  notificationsError?: string | null;
  notificationsOpen?: boolean;
  notificationSoundEnabled?: boolean;
  onBellClick?: () => void;
  onNotificationClick?: (proposal: Proposal) => void;
  onViewAllNotifications?: () => void;
  onRetryNotifications?: () => void;
  onToggleNotificationSound?: () => void;
  onUserClick?: () => void;
}

export default function Head({
  onToggleNav,
  navOpen,
  title = "CDM-OS Guardian & Governance",
  shortTitle = "CDM-OS",
  userName = "Salesforce user",
  notificationCount = 0,
  notifications = [],
  notificationsLoading = false,
  notificationsError = null,
  notificationsOpen = false,
  notificationSoundEnabled = false,
  onBellClick,
  onNotificationClick,
  onViewAllNotifications,
  onRetryNotifications,
  onToggleNotificationSound,
  onUserClick,
}: HeadProps) {
  const [mcpStatus, setMcpStatus] = useState<McpStatus>("checking");
  const [isMock, setIsMock] = useState(false);
  const [orgType, setOrgType] = useState<SalesforceOrgType | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgUserDisplayName, setOrgUserDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBellClick?.();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notificationsOpen, onBellClick]);

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
        const returnedOrgType =
          online && "org_type" in result && typeof result.org_type === "string"
            ? result.org_type
            : null;
        setOrgType(
          returnedOrgType === "Developer" ||
            returnedOrgType === "UAT" ||
            returnedOrgType === "Sandbox" ||
            returnedOrgType === "Production" ||
            returnedOrgType === "Mock"
            ? returnedOrgType
            : null,
        );
        setOrgUserDisplayName(
          online &&
            "org_user_name" in result &&
            typeof result.org_user_name === "string"
            ? result.org_user_name
            : null,
        );
        setOrgName(
          online && "org_name" in result && typeof result.org_name === "string"
            ? result.org_name
            : null,
        );
      } catch {
        if (!active) return;
        setMcpStatus("offline");
        setIsMock(false);
        setOrgType(null);
        setOrgName(null);
        setOrgUserDisplayName(null);
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
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-100 sm:text-base">
          <span className="md:hidden">{shortTitle}</span>
          <span className="hidden md:inline">{title}</span>
        </h1>
        {mcpStatus === "online" && orgType && (
          <span
            role="status"
            aria-label={`Salesforce org: ${orgType}${orgName ? ` - ${orgName}` : ""}`}
            title={
              orgType === "UAT"
                ? "Org type is configured as UAT using SF_ORG_TYPE."
                : `Connected Salesforce org: ${orgType}${isMock ? " mock data" : ""}.`
            }
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[9px] font-semibold sm:px-2.5 sm:text-xs ${
              orgType === "Production"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                : orgType === "UAT"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : orgType === "Sandbox"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
                    : orgType === "Developer"
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                      : "border-slate-600 bg-slate-700/50 text-slate-200"
            }`}
          >
            {orgType}{orgName ? ` - ${orgName}` : ""}
          </span>
        )}
      </div>
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
        <div className="relative">
          <button
            type="button"
            onClick={onBellClick}
            aria-label={
              notificationCount > 0
                ? `${notificationCount} unread approval notifications`
                : "Notifications"
            }
            aria-expanded={notificationsOpen}
            aria-controls="notification-panel"
            className="relative rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-800/60"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <section
              id="notification-panel"
              aria-label="Unread approval notifications"
              className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Notifications
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {notificationCount} unread{" "}
                    {notificationCount === 1 ? "approval" : "approvals"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onToggleNotificationSound}
                    aria-label={
                      notificationSoundEnabled
                        ? "Mute notification sound"
                        : "Enable notification sound"
                    }
                    title={
                      notificationSoundEnabled
                        ? "Mute notification sound"
                        : "Enable notification sound"
                    }
                    className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  >
                    {notificationSoundEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </button>
                  {notificationsError && (
                  <button
                    type="button"
                    onClick={onRetryNotifications}
                    aria-label="Retry loading notifications"
                    className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  )}
                </div>
              </header>

              {notificationsLoading ? (
                <p role="status" className="px-4 py-6 text-center text-xs text-slate-400">
                  Loading pending approvals…
                </p>
              ) : notificationsError ? (
                <p role="alert" className="px-4 py-5 text-xs leading-5 text-rose-200">
                  Unable to load notifications: {notificationsError}
                </p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">
                  You’re all caught up. No new approvals to review.
                </p>
              ) : (
                <ul className="max-h-80 divide-y divide-slate-800 overflow-y-auto">
                  {notifications.slice(0, 8).map((proposal) => (
                    <li key={proposal.id}>
                      <button
                        type="button"
                        onClick={() => onNotificationClick?.(proposal)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                      >
                        <span className="block truncate text-xs font-semibold text-slate-100">
                          {proposal.tool_id.replaceAll("_", " ")}
                        </span>
                        <span className="mt-1 block break-words text-[11px] leading-4 text-slate-400">
                          {getProposalTarget(proposal)}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {proposal.tier} · {new Date(proposal.created_at).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <footer className="border-t border-slate-800 p-2">
                <button
                  type="button"
                  onClick={onViewAllNotifications}
                  className="w-full rounded-lg px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/10"
                >
                  View all pending approvals
                </button>
              </footer>
            </section>
          )}
        </div>

        <button
          type="button"
          onClick={onUserClick}
          aria-label={`Account: ${orgUserDisplayName ?? userName}`}
          title={orgUserDisplayName ?? userName}
          className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-slate-200 transition-colors hover:bg-slate-800/60 sm:px-2"
        >
          <CircleUserRound className="h-5 w-5" />
          <span className="hidden max-w-[120px] truncate text-sm sm:inline">
            {orgUserDisplayName ?? userName}
          </span>
        </button>
      </div>
    </header>
  );
}

function getProposalTarget(proposal: Proposal): string {
  const objectName =
    proposal.input_payload.object_name ?? proposal.input_payload.object;
  const fieldName =
    proposal.input_payload.field_name ??
    proposal.input_payload.field_api_name ??
    proposal.input_payload.field;
  if (typeof objectName === "string" && typeof fieldName === "string") {
    return `${objectName}.${fieldName}`;
  }
  return `Agent ${proposal.agent_id}`;
}