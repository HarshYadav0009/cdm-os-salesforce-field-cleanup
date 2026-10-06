export interface AuditActivity {
  id: string;
  time: string;
  message: string;
  source: string;
}

interface Props {
  activities: AuditActivity[];
  onExport?: () => void;
}

export default function RecentAuditActivity({ activities, onExport }: Props) {
  return (
    <div className="m-1 rounded-lg border border-slate-700 bg-slate-900">
      <h2 className="px-4 py-2 text-center font-bold uppercase">
        Recent Audit Activity
      </h2>

      <ul className="divide-y divide-slate-500 border-t border-slate-500">
        {activities.map((item) => (
          <li key={item.id} className="p-3 text-sm">
            <span className="text-slate-400">{item.time}</span>{" "}
            <span>
              {item.message} - <span className="text-slate-400">{item.source}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-center">
        <button
          onClick={onExport}
          className="m-3 cursor-pointer rounded-lg bg-blue-400 px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-blue-300"
        >
          Export Compliance Report (PDF/CSV)
        </button>
      </div>
    </div>
  );
}