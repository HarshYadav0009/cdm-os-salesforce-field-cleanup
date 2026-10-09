"use client";

import { useEffect } from "react";
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
        id="main-navigation"
        aria-label="Main navigation"
        className={[
          /* Base */
          "flex flex-col gap-1 bg-slate-900 border-r border-slate-800 p-3 lg:p-4",
          /* Fixed on mobile, static on desktop */
          "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out",
          "lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shrink-0",
          /* Slide animation */
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header — only visible on mobile */}
        <div className="mb-2 flex items-center justify-between lg:hidden">
          <span className="px-2 text-sm font-semibold text-slate-300">
            Menu
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#4b7bec] text-white"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
              ].join(" ")}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="mt-auto border-t border-slate-800 pt-3">
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
