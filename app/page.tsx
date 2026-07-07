export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Exit Compliance Pro
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Genetec Exit Compliance & Bespoke Reporting
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Upload Genetec CSV exports, generate clear compliance dashboards,
            produce door reports, and create bespoke attendance reports for customers.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Door Compliance Reports"
            description="Check exits, doors, forced-open events, held-open events and compliance issues."
          />

          <DashboardCard
            title="Upload Genetec CSV"
            description="Import exported CSV files from Genetec and process them into usable reports."
            href="/upload"
          />

          <DashboardCard
            title="Bespoke Attendance Reports"
            description="Create customer-specific reports such as daily attendance, visitor trends and occupancy."
          />

          <DashboardCard
            title="Customers"
            description="Manage customer accounts, sites, report preferences and email recipients."
          />

          <DashboardCard
            title="Sites"
            description="Separate reports by building, floor, access control system or tenant area."
          />

          <DashboardCard
            title="Settings"
            description="Configure report templates, branding, email schedules and CSV mappings."
          />
        </section>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  description,
  href = "#",
}: {
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      <a
        href={href}
        className="mt-6 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
      >
        Open
      </a>
    </div>
  );
}
