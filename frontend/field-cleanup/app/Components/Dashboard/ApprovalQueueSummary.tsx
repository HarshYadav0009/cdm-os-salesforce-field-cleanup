export interface Approval {
  id: string;
  object: string;
  action: string;
  tier: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
}

interface Props {
  approvals: Approval[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function ApprovalQueueSummary({
  approvals,
  onApprove,
  onReject,
}: Props) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900">
      <h2 className="p-2 text-center font-bold uppercase">
        Approval Queue Summary
      </h2>

      <ul className="divide-y divide-slate-500">
        {approvals.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {item.object}: <span className="font-medium">{item.action}</span>
              </p>
              <p className="text-xs text-slate-400">
                (Tier {item.tier}) - Risk:{" "}
                <span
                  className={
                    item.risk === "HIGH"
                      ? "text-red-400"
                      : item.risk === "MEDIUM"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }
                >
                  {item.risk}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => onApprove?.(item.id)}
                className="cursor-pointer rounded-2xl bg-emerald-300/30 px-3 py-1 text-xs font-medium text-emerald-500 transition-colors hover:bg-emerald-300/50"
              >
                Approve
              </button>
              <button
                onClick={() => onReject?.(item.id)}
                className="cursor-pointer rounded-2xl bg-red-300/30 px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-300/50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}