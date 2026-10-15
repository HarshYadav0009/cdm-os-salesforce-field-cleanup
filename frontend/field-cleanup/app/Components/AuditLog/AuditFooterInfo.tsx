"use client";

import AuditFooterCard from "./AuditFooterCard";
import type { AuditInfoCard } from "./types";

interface AuditFooterInfoProps {
  cards: AuditInfoCard[];
}

export default function AuditFooterInfo({ cards }: AuditFooterInfoProps) {
  return (
    <div className="flex w-full flex-col gap-4 font-sans md:flex-row">
      {cards.map((c) => (
        <AuditFooterCard
          key={c.id}
          title={c.title}
          label={c.label}
          value={c.value}
        />
      ))}

      <div className="flex w-full flex-col justify-center rounded-lg border border-slate-700/50 bg-[#1c1e26] p-4 text-xs leading-5 text-slate-400 md:w-[260px] md:shrink-0">
        Audit export is not available: the connected backend exposes read-only
        audit listing, but no export endpoint.
      </div>
    </div>
  );
}