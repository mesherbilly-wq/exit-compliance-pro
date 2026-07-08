import { DashboardCard } from "@/components/dashboard/dashboard-card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
        Overview
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        Genetec Exit Compliance & Bespoke Reporting
      </h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Upload Genetec CSV exports, generate clear compliance dashboards,
        produce door reports, and create bespoke attendance reports for
        customers.
      </p>

      <section className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Door Compliance Reports"
          description="Check exits, doors, forced-open events, held-open events and compliance issues."
          href="/reports/exit-compliance"
        />

        <DashboardCard
          title="Upload Genetec CSV"
          description="Import exported CSV files from Genetec and process them into usable reports."
          href="/imports"
        />

        <DashboardCard
          title="Bespoke Attendance Reports"
          description="Create customer-specific reports such as daily attendance, visitor trends and occupancy."
          href="/reports/attendance"
        />

        <DashboardCard
          title="Customers"
          description="Manage customer accounts, sites, report preferences and email recipients."
          href="/customers"
        />

        <DashboardCard
          title="Sites"
          description="Separate reports by building, floor, access control system or tenant area."
          href="/sites"
        />

        <DashboardCard
          title="Settings"
          description="Configure report templates, branding, email schedules and CSV mappings."
          href="/settings"
        />
      </section>
    </div>
  );
}
