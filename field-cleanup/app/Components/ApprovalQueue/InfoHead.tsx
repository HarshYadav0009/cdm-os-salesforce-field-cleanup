interface InfoHeadProps {
  title: string;
  description: string;
}

export default function InfoHead({ title, description }: InfoHeadProps) {
  return (
    <div className="space-y-1 p-3 sm:p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide sm:text-base">
        {title}
      </h2>
      <p className="max-w-prose text-xs text-slate-400 sm:text-sm">
        {description}
      </p>
    </div>
  );
}