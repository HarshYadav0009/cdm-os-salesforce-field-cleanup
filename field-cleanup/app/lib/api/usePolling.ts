"use client";

import { useEffect } from "react";

export function usePolling(reload: () => void, interval = 10000) {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = window.setInterval(refresh, interval);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload, interval]);
}
