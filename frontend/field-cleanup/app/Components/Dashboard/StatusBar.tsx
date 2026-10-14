interface StatusItem {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}

export default function StatusBar({ items }: { items: StatusItem[] }) {
  return (
    <div className="mx-2 my-1 rounded-lg border border-slate-700 bg-slate-900 px-6 py-4 text-slate-200">
      <div className="flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-x divide-slate-700">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={[
              "flex-1 py-3 md:py-0",
              i === 0 ? "md:pr-6" : "md:px-6",
              i === items.length - 1 ? "md:pr-0" : "",
            ].join(" ")}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {item.label}
            </h2>
            <p className="mt-1 text-sm">
              <span className={`font-medium ${item.valueClass ?? ""}`}>
                {item.value}
              </span>
              {item.hint && (
                <span className="ml-1 text-amber-400">{item.hint}</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}