"use client";

import { useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "info" | "working";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastProps extends ToastItem {
  onClose: (id: string) => void;
}

const CONFIG: Record<
  ToastType,
  {
    defaultTitle: string;
    icon: typeof CheckCircle2;
    iconClass: string;
    borderClass: string;
    progressClass: string;
  }
> = {
  success: {
    defaultTitle: "Success",
    icon: CheckCircle2,
    iconClass: "text-green-600",
    borderClass: "border-green-200",
    progressClass: "bg-green-500",
  },
  error: {
    defaultTitle: "Error",
    icon: XCircle,
    iconClass: "text-red-600",
    borderClass: "border-red-200",
    progressClass: "bg-red-500",
  },
  info: {
    defaultTitle: "Information",
    icon: Info,
    iconClass: "text-blue-600",
    borderClass: "border-blue-200",
    progressClass: "bg-blue-500",
  },
  working: {
    defaultTitle: "Working",
    icon: LoaderCircle,
    iconClass: "text-amber-600 animate-spin",
    borderClass: "border-amber-200",
    progressClass: "bg-amber-500",
  },
};

export default function Toast({
  id,
  type,
  message,
  title,
  duration = 4000,
  onClose,
}: ToastProps) {
  /* Auto-dismiss — skip for "working" (duration 0 or type === "working") */
  useEffect(() => {
    if (type === "working" || !duration || duration <= 0) return;
    const t = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(t);
  }, [id, type, duration, onClose]);

  const config = CONFIG[type];
  const Icon = config.icon;
  const displayTitle = title ?? config.defaultTitle;

  return (
    <div
      role="alert"
      className={`w-full overflow-hidden rounded-xl border ${config.borderClass} bg-white shadow-xl animate-in slide-in-from-right-5 fade-in duration-300`}
    >
      {/* Main content */}
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">
          <Icon size={23} strokeWidth={2.2} className={config.iconClass} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{displayTitle}</p>
          <p className="mt-1 text-sm leading-5 text-gray-600">{message}</p>
        </div>

        <button
          type="button"
          onClick={() => onClose(id)}
          aria-label="Close notification"
          className="shrink-0 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <X size={17} />
        </button>
      </div>

      {/* Progress bar (auto-dismiss toasts) */}
      {type !== "working" && duration > 0 && (
        <div className="h-1 w-full bg-gray-100">
          <div
            className={`h-full ${config.progressClass}`}
            style={{ animation: `toast-progress ${duration}ms linear forwards` }}
          />
        </div>
      )}

      {/* Indeterminate bar (working) */}
      {type === "working" && (
        <div className="h-1 w-full overflow-hidden bg-gray-100">
          <div className="h-full w-1/3 animate-[toast-working_1.2s_ease-in-out_infinite] bg-amber-500" />
        </div>
      )}
    </div>
  );
}