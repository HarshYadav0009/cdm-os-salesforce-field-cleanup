interface StatCardProps {
  label: string;
  value: string | number;
}

export default function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
      <h3 className="text-sm uppercase tracking-wider text-slate-400">
        {label}
      </h3>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}