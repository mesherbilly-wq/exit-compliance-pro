import { ReportCard } from "@/components/reports/report-card";
import { REPORTS } from "@/lib/reports/config";

export function ReportsSuiteContent() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Reports
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Reporting Suite
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Generate compliance, attendance, occupancy and operational reports
          from imported Genetec CSV data.
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <ReportCard key={report.slug} report={report} />
        ))}
      </section>
    </div>
  );
}
