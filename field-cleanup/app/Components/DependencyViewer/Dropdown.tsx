"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return options;
    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  /* Close on outside click */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (open) setSearch("");
          setOpen((current) => !current);
        }}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700",
          "bg-slate-950/80 px-3.5 py-3 text-left text-sm text-slate-200",
          "transition-colors hover:border-slate-500 focus:border-blue-500 focus:outline-none",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/30">
          {options.length > 8 && (
            <label className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search options…"
                aria-label={`Search ${ariaLabel ?? "options"}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
              <span className="text-[10px] tabular-nums text-slate-500">
                {filteredOptions.length}
              </span>
            </label>
          )}
          <ul
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto p-1.5"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-slate-500">
                {options.length === 0 ? "No options available" : "No matches"}
              </li>
            ) : (
              filteredOptions.map((option) => (
                <li
                  key={option}
                  role="option"
                  aria-selected={option === value}
                  onClick={() => select(option)}
                  className={[
                    "cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-colors",
                    option === value
                      ? "bg-blue-500/10 font-medium text-blue-200"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  ].join(" ")}
                >
                  {option}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}