import { Network } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex items-start gap-4 border-b border-slate-800 bg-gradient-to-r from-blue-500/[0.06] via-transparent to-transparent px-4 py-5 sm:px-6 sm:py-6">
      <span className="hidden rounded-2xl border border-blue-400/15 bg-blue-500/10 p-3 text-blue-300 sm:inline-flex">
        <Network className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
          Salesforce governance
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
          {title}
        </h2>
        <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">
          {description}
        </p>
      </div>
    </div>
  );
}