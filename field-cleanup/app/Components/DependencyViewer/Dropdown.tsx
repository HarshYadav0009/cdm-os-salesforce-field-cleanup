"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  ariaLabel,
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-600",
          "bg-slate-900 px-3 py-2 text-left text-sm text-slate-200",
          "transition-colors focus:border-blue-500 focus:outline-none",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No options</li>
          )}
          {options.map((o) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              onClick={() => select(o)}
              className={[
                "cursor-pointer px-3 py-2 text-sm transition-colors",
                o === value
                  ? "bg-slate-800 text-blue-400"
                  : "text-slate-200 hover:bg-slate-700",
              ].join(" ")}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}