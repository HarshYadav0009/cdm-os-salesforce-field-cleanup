// src/lib/ws/RealtimeProvider.tsx
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type RealtimeEvent = { type: string; payload: unknown };
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "unconfigured";

const Ctx = createContext<{
  last: RealtimeEvent | null;
  status: ConnectionStatus;
  subscribe: (fn: (event: RealtimeEvent) => void) => () => void;
}>({
  last: null,
  status: "disconnected",
  subscribe: () => () => {},
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [last, setLast] = useState<RealtimeEvent | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    process.env.NEXT_PUBLIC_WS_URL ? "connecting" : "unconfigured",
  );
  const listeners = useRef(new Set<(event: RealtimeEvent) => void>());

  const subscribe = useCallback((fn: (event: RealtimeEvent) => void) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!url) return;

    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let retryDelay = 1000;

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      socket = new WebSocket(url);
      socket.onopen = () => {
        retryDelay = 1000;
        setStatus("connected");
      };
      socket.onmessage = (message) => {
        try {
          const parsed: unknown = JSON.parse(message.data);
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("type" in parsed) ||
            typeof parsed.type !== "string" ||
            !("payload" in parsed)
          ) {
            throw new Error("Received an invalid realtime event.");
          }
          const evt = parsed as RealtimeEvent;
          setLast(evt);
          listeners.current.forEach((fn) => fn(evt));
        } catch (error) {
          console.error("Unable to process realtime event.", error);
        }
      };
      socket.onerror = () => setStatus("disconnected");
      socket.onclose = () => {
        if (disposed) return;
        setStatus("disconnected");
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ last, status, subscribe }),
    [last, status, subscribe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRealtime = () => useContext(Ctx);
