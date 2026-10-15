"use client";

import { useEffect, useState } from "react";
import Head from "./Head";
import LeftSideBar from "./LeftSideBar";
import RightSideSection from "./RightSideSection";
import { DEFAULT_NAV_ID } from "./navigation";        // ← value only
import type { NavId } from "./navigation";            // ← type only

export default function MainPage() {
  const [activePage, setActivePage] = useState<NavId>(DEFAULT_NAV_ID);
  const [dependencyViewerVisited, setDependencyViewerVisited] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const navigateTo = (page: NavId) => {
    setActivePage(page);
    if (page === "DependencyViewer") setDependencyViewerVisited(true);
  };

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("cdm-os-theme");
    const initialTheme = storedTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = initialTheme;
    const syncThemeState = window.setTimeout(() => setTheme(initialTheme), 0);
    return () => window.clearTimeout(syncThemeState);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("cdm-os-theme", nextTheme);
  };

  return (
    <div className="flex h-dvh flex-col bg-[#111319] text-slate-100">
      <Head
        navOpen={mobileNavOpen}
        onToggleNav={() => setMobileNavOpen((open) => !open)}
        notificationCount={3}
        userName="Sumit"
        onBellClick={() => navigateTo("ApprovalQueue")}
      />

      <div className="flex min-h-0 flex-1">
        <LeftSideBar
          activePage={activePage}
          onNavigate={navigateTo}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <RightSideSection
          activePage={activePage}
          dependencyViewerVisited={dependencyViewerVisited}
        />
      </div>
    </div>
  );
}