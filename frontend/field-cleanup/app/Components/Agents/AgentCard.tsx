// src/components/agents/AgentCard.tsx
import type { Agent } from "@/types/agent";

export default function AgentCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick?: () => void;
}) {
  const statusColor =
    agent.status === "ACTIVE"
      ? "text-emerald-400"
      : agent.status === "HALTED"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-left hover:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{agent.name}</h3>
        <span className={`text-xs font-bold ${statusColor}`}>
          {agent.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Tier {agent.tier} · Guardian XXXXXXXX: {agent.guardian}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Last activity: {agent.lastActivity}
      </p>
    </button>
  );
}
