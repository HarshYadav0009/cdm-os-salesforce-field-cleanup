interface AuditFooterCardProps {
  title: string;
  label: string;
  value: string;
}

export default function AuditFooterCard({
  title,
  label,
  value,
}: AuditFooterCardProps) {
  return (
    <div className="flex flex-1 flex-col rounded-lg border border-slate-700/50 bg-[#1c1e26] p-4">
      <h3 className="text-[13px] font-medium text-slate-100">{title}</h3>
      <div className="my-3 h-px w-full bg-slate-600/50" />
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-slate-400">{label}</span>
        <p className="truncate text-[13px] text-slate-200" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}