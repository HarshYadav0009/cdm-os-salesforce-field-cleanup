"use client";
import type { GatewayTool } from "@/app/lib/api/salesforce";
import { panel } from "./shared";
export default function ToolCatalog({ tools }: { tools: GatewayTool[] }) {
  return (
    <div className={panel}>
      <h2 className="text-lg font-semibold">Gateway tool catalog</h2>
      <p className="mt-1 text-sm text-slate-400">
        Available gateway capabilities. Analyze individual fields and propose
        changes in Dependency Viewer; manage recovery in Backup Recovery.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <div
            key={tool.tool_id}
            className="rounded-xl border border-white/10 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{tool.name}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs ${tool.tier === "Tier-1" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
              >
                {tool.tier}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {tool.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
