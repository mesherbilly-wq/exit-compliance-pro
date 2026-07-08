import { DashboardCard } from "@/components/dashboard/dashboard-card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
        Life Safety Overview
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        Fire Exit Compliance & Life Safety Platform
      </h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Monitor fire exit compliance, held-open events, door health and repeat
        issue doors. Import Genetec CSV exports to analyse life safety performance
        and prepare executive reporting.
      </p>

      <section className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Fire Exit Compliance"
          description="Review held-open events, forced-open incidents and compliance scoring across fire exit doors."
          href="/compliance"
        />

        <DashboardCard
          title="Import Genetec CSV"
          description="Upload fire exit and door event exports from Genetec for compliance analysis."
          href="/imports"
        />

        <DashboardCard
          title="Door Health"
          description="Monitor exit door condition, repeat issue doors and doors requiring operational attention."
          href="/doors"
        />

        <DashboardCard
          title="Operational Heat Maps"
          description="Identify high-pressure exit doors, busy access points and time-of-day life safety hotspots."
          href="/heat-maps"
        />

        <DashboardCard
          title="Compliance Trends"
          description="Track held-open trends, exception patterns and improving or declining exit door performance."
          href="/trends"
        />

        <DashboardCard
          title="Executive Reports"
          description="Prepare board-ready summaries of fire exit compliance, risk exposure and remediation priorities."
          href="/executive-reports"
        />
      </section>
    </div>
  );
}
