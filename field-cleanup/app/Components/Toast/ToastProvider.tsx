"use client";

import { createContext, useCallback, useMemo, useRef, useState } from "react";
import Toast, { type ToastItem } from "./Toast";

interface ToastContextValue {
  addToast: (item: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  update: (id: string, patch: Partial<Omit<ToastItem, "id">>) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback<ToastContextValue["addToast"]>((item) => {
    const id = `toast-${Date.now()}-${counter.current++}`;
    setToasts((prev) => [...prev, { id, duration: 4000, ...item }]);
    return id;
  }, []);

  const update = useCallback<ToastContextValue["update"]>((id, patch) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const value = useMemo(
    () => ({ addToast, dismiss, update }),
    [addToast, dismiss, update]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Stacked viewport — position lives here, once */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-5 right-5 z-[9999] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-3"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast {...t} onClose={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}