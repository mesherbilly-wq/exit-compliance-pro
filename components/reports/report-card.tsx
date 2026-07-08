import Link from "next/link";
import {
  REPORT_STATUS_LABELS,
  type ReportDefinition,
  type ReportStatus,
} from "@/lib/reports/config";

const STATUS_STYLES: Record<ReportStatus, string> = {
  available: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  preview: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  requires_import: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
};

export function ReportCard({ report }: { report: ReportDefinition }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">{report.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[report.status]}`}
        >
          {REPORT_STATUS_LABELS[report.status]}
        </span>
      </div>

      <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">
        {report.description}
      </p>

      <Link
        href={report.href}
        className="mt-6 inline-block w-fit rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
      >
        Open
      </Link>
    </div>
  );
}
