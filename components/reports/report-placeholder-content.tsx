import { ReportPageShell } from "@/components/reports/report-page-shell";
import type { ReportDefinition } from "@/lib/reports/config";

type ReportPlaceholderContentProps = {
  report: ReportDefinition;
  features: string[];
};

export function ReportPlaceholderContent({
  report,
  features,
}: ReportPlaceholderContentProps) {
  return (
    <ReportPageShell report={report}>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Planned capabilities</h3>
        <ul className="mt-4 space-y-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-slate-300"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <p className="text-sm text-slate-400">
          This report is in preview. Full analysis will be available in a future
          release.
        </p>
      </section>
    </ReportPageShell>
  );
}
