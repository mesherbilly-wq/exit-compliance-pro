import Link from "next/link";
import type { ReportDefinition } from "@/lib/reports/config";

type ReportPageShellProps = {
  report: ReportDefinition;
  children: React.ReactNode;
};

export function ReportPageShell({ report, children }: ReportPageShellProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link
          href="/reports"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to reports
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-cyan-400">
          {report.title}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">{report.title}</h2>
        <p className="mt-4 max-w-3xl text-slate-300">{report.description}</p>
      </div>

      {children}
    </div>
  );
}
