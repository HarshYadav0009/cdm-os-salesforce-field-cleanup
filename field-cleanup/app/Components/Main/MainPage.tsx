"use client";

import { useEffect, useRef, useState } from "react";
import Head from "./Head";
import LeftSideBar from "./LeftSideBar";
import RightSideSection from "./RightSideSection";
import { DEFAULT_NAV_ID } from "./navigation";        // ← value only
import type { NavId } from "./navigation";            // ← type only
import { useApiResource } from "@/app/lib/api/useApiResource";
import { useRealtime } from "@/app/lib/ws/RealtimeProvider";
import type { Proposal } from "@/types/governance";

export default function MainPage() {
  const [activePage, setActivePage] = useState<NavId>(DEFAULT_NAV_ID);
  const [dependencyViewerVisited, setDependencyViewerVisited] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(
    () => {
      if (typeof window === "undefined") return [];
      try {
        const storedIds = window.localStorage.getItem(
          "cdm-os-read-notifications",
        );
        if (!storedIds) return [];
        const parsed: unknown = JSON.parse(storedIds);
        return Array.isArray(parsed) &&
          parsed.every((id): id is string => typeof id === "string")
          ? parsed
          : [];
      } catch (error) {
        console.error("Unable to load read notification state.", error);
        return [];
      }
    },
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousApprovalIdsRef = useRef<Set<string> | null>(null);
  const approvalsSource = useApiResource<Proposal[]>(
    "/proposals/queue/pending",
    [],
  );
  const { reload: reloadApprovals } = approvalsSource;
  const { subscribe } = useRealtime();

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") reloadApprovals();
    }, 15000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") reloadApprovals();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [reloadApprovals]);

  useEffect(() => {
    if (approvalsSource.loading || approvalsSource.error) return;

    const currentIds = new Set(
      approvalsSource.data.map((proposal) => proposal.id),
    );
    const previousIds = previousApprovalIdsRef.current;
    previousApprovalIdsRef.current = currentIds;

    if (
      previousIds === null ||
      !notificationSoundEnabled ||
      !approvalsSource.data.some((proposal) => !previousIds.has(proposal.id))
    ) {
      return;
    }

    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(1175, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.45);
  }, [
    approvalsSource.data,
    approvalsSource.error,
    approvalsSource.loading,
    notificationSoundEnabled,
  ]);

  useEffect(
    () =>
      subscribe((event) => {
        if (
          [
            "approval.created",
            "approval.updated",
            "proposal.created",
            "proposal.updated",
          ].includes(event.type)
        ) {
          reloadApprovals();
        }
      }),
    [reloadApprovals, subscribe],
  );

  const navigateTo = (page: NavId) => {
    setActivePage(page);
    if (page === "DependencyViewer") setDependencyViewerVisited(true);
    setNotificationsOpen(false);
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

  const markNotificationRead = (proposalId: string) => {
    setReadNotificationIds((currentIds) => {
      if (currentIds.includes(proposalId)) return currentIds;
      const nextIds = [...currentIds, proposalId];
      try {
        window.localStorage.setItem(
          "cdm-os-read-notifications",
          JSON.stringify(nextIds),
        );
      } catch (error) {
        console.error("Unable to save read notification state.", error);
      }
      return nextIds;
    });
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((currentIds) => {
      const nextIds = Array.from(
        new Set([
          ...currentIds,
          ...approvalsSource.data.map((proposal) => proposal.id),
        ]),
      );
      try {
        window.localStorage.setItem(
          "cdm-os-read-notifications",
          JSON.stringify(nextIds),
        );
      } catch (error) {
        console.error("Unable to save read notification state.", error);
      }
      return nextIds;
    });
  };

  const unreadNotifications = approvalsSource.data.filter(
    (proposal) => !readNotificationIds.includes(proposal.id),
  );
  const unreadNotificationCount = unreadNotifications.length;

  return (
    <div className="flex h-dvh flex-col bg-[#111319] text-slate-100">
      <Head
        navOpen={mobileNavOpen}
        onToggleNav={() => setMobileNavOpen((open) => !open)}
        notificationCount={unreadNotificationCount}
        notifications={unreadNotifications}
        notificationsLoading={approvalsSource.loading}
        notificationsError={approvalsSource.error}
        notificationsOpen={notificationsOpen}
        onBellClick={() => {
          setNotificationsOpen((open) => !open);
          approvalsSource.reload();
        }}
        onNotificationClick={(proposal) => {
          markNotificationRead(proposal.id);
          navigateTo("ApprovalQueue");
        }}
        onViewAllNotifications={() => {
          markAllNotificationsRead();
          navigateTo("ApprovalQueue");
        }}
        onRetryNotifications={reloadApprovals}
        notificationSoundEnabled={notificationSoundEnabled}
        onToggleNotificationSound={() => {
          if (notificationSoundEnabled) {
            setNotificationSoundEnabled(false);
            return;
          }

          const AudioContextConstructor =
            window.AudioContext ??
            (window as Window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!AudioContextConstructor) return;

          const context =
            audioContextRef.current ?? new AudioContextConstructor();
          audioContextRef.current = context;
          void context.resume().then(() => {
            setNotificationSoundEnabled(true);
          });
        }}
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