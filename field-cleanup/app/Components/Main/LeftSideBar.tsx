"use client";

import { useEffect, useRef } from "react";
import { Moon, Sun, X } from "lucide-react";
import { NAV_ITEMS } from "./navigation"; // ← value only
import type { NavId } from "./navigation"; // ← type only

interface LeftSideBarProps {
  activePage: NavId;
  onNavigate: (id: NavId) => void;

  /** Mobile drawer state (ignored on lg+) */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function LeftSideBar({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  theme,
  onToggleTheme,
}: LeftSideBarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (sidebarRef.current)
        sidebarRef.current.inert = !desktop.matches && !mobileOpen;
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, [mobileOpen]);
  /* Close mobile drawer on Escape */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseMobile();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  /* Lock body scroll while the drawer is open */
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleNavigate = (id: NavId) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* ── Backdrop (mobile only) ── */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        id="main-navigation"
        aria-label="Main navigation"
        className={[
          /* Base */
          "flex min-h-0 flex-col overflow-hidden bg-slate-900 border-r border-slate-800 p-3 lg:p-4",
          /* Fixed on mobile, static on desktop */
          "fixed inset-y-0 left-0 z-50 h-dvh w-64 max-w-[calc(100vw_-_1rem)] transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          "lg:static lg:z-auto lg:h-full lg:w-64 lg:translate-x-0 lg:shrink-0",
          /* Slide animation */
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header — only visible on mobile */}
        <div className="mb-3 flex shrink-0 items-center justify-between border-b border-slate-800 pb-3">
          <span className="px-2 text-sm font-semibold text-slate-300">
            Workspace
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          aria-label="Workspace pages"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-400",
                  isActive
                    ? "border-blue-400/25 bg-blue-500/15 text-blue-200"
                    : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/50 hover:text-slate-200",
                ].join(" ")}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-300" : "text-slate-500 group-hover:text-slate-300"}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-3 shrink-0 border-t border-slate-800 pt-3 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "light"}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-slate-100"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
