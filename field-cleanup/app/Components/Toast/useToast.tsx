"use client";

import { useContext, useMemo } from "react";
import { ToastContext } from "./ToastProvider";

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider />");

  const { addToast, dismiss, update } = ctx;

  return useMemo(
    () => ({
      /* Low-level */
      toast: addToast,
      dismiss,
      update,

      /* Shorthands */
      success: (message: string, title?: string) =>
        addToast({ type: "success", message, title }),

      error: (message: string, title?: string) =>
        addToast({ type: "error", message, title }),

      info: (message: string, title?: string) =>
        addToast({ type: "info", message, title }),

      /** Persists until updated or dismissed */
      working: (message: string, title?: string) =>
        addToast({ type: "working", message, title, duration: 0 }),

      /** Promise helper — auto-updates working → success/error */
      promise: <T,>(
        p: Promise<T>,
        msgs: {
          loading: string;
          success: string | ((v: T) => string);
          error: string | ((e: unknown) => string);
        },
      ) => {
        const id = addToast({
          type: "working",
          message: msgs.loading,
          duration: 0,
        });

        return p
          .then((v) => {
            update(id, {
              type: "success",
              message:
                typeof msgs.success === "function"
                  ? msgs.success(v)
                  : msgs.success,
              duration: 4000,
            });
            return v;
          })
          .catch((e) => {
            update(id, {
              type: "error",
              message:
                typeof msgs.error === "function" ? msgs.error(e) : msgs.error,
              duration: 4000,
            });
            throw e;
          });
      },
    }),
    [addToast, dismiss, update],
  );
}
