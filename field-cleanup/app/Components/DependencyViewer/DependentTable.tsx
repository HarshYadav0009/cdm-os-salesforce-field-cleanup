"use client";

export interface Dependency {
  id: string;
  referenceComponent: string;
  type: string;
  impactArea: string;
  referenceContext: string;
}

interface DependentTableProps {
  dependencies: Dependency[];
  onRowClick?: (dep: Dependency) => void;
}

export default function DependentTable({
  dependencies,
  onRowClick,
}: DependentTableProps) {
  if (dependencies.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-12 text-center text-sm text-slate-400">
        No dependencies found for this field.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg bg-slate-900 text-white shadow-md">
      {/* ── Desktop / tablet: table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="bg-slate-700">
            <tr>
              {[
                "Reference Component",
                "Type",
                "Impact Area",
                "Reference Context",
              ].map((h) => (
                <th
                  key={h}
                  className="border-b border-slate-600/80 px-4 py-3 text-sm font-medium text-slate-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dependencies.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={[
                  "border-b border-slate-600/80 transition-colors last:border-b-0 hover:bg-slate-700/30",
                  onRowClick ? "cursor-pointer" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3 text-sm text-slate-100">
                  {row.referenceComponent}
                </td>
                <td className="px-4 py-3 text-sm text-slate-100">{row.type}</td>
                <td className="px-4 py-3 text-sm text-slate-100">
                  {row.impactArea}
                </td>
                <td className="px-4 py-3 text-sm text-slate-100">
                  {row.referenceContext}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: card list ── */}
      <ul className="divide-y divide-slate-700 md:hidden">
        {dependencies.map((row) => (
          <li
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={[
              "space-y-2 p-4",
              onRowClick ? "cursor-pointer hover:bg-slate-800/40" : "",
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-slate-100">
              {row.referenceComponent}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Type" value={row.type} />
              <Field label="Impact Area" value={row.impactArea} />
              <div className="col-span-2">
                <Field label="Context" value={row.referenceContext} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="truncate text-slate-100">{value}</p>
    </div>
  );
}