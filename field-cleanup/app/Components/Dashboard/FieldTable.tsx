export interface Job {
  id: string;
  object: string;
  status: string;
  candidateFields: number;
}

export default function FieldTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
      <h2 className="px-4 py-2 font-bold uppercase">Job Status Table</h2>

      {/* Horizontal scroll on small screens */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-700 font-bold">
            <tr>
              <th className="py-2 pl-4 pr-5 text-left">Job ID</th>
              <th className="py-2 pr-5 text-left">Salesforce Object</th>
              <th className="py-2 pr-5 text-left">Status</th>
              <th className="py-2 pr-5 text-left">Candidate Fields</th>
              <th className="py-2 pr-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="cursor-pointer border-b border-slate-500 transition-colors last:border-b-0 hover:bg-slate-700"
              >
                <td className="py-3 pl-4 pr-5">{job.id}</td>
                <td className="py-3 pr-5">{job.object}</td>
                <td className="py-3 pr-5">{job.status}</td>
                <td className="py-3 pr-5">{job.candidateFields}</td>
                <td className="py-3 pr-4 text-sky-400">View Details</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}