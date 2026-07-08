import Link from "next/link";

export function DashboardCard({
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
      <Link
        href={href}
        className="mt-6 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
      >
        Open
      </Link>
    </div>
  );
}
