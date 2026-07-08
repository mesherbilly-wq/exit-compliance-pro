type SectionPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function SectionPageShell({
  eyebrow,
  title,
  description,
  children,
}: SectionPageShellProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-4 max-w-3xl text-slate-300">{description}</p>
      </div>

      {children}
    </div>
  );
}

type FeaturePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
};

export function FeaturePlaceholder({
  eyebrow,
  title,
  description,
  features,
}: FeaturePlaceholderProps) {
  return (
    <SectionPageShell eyebrow={eyebrow} title={title} description={description}>
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
          This section is ready for implementation. Import Genetec fire exit
          data to unlock analysis across the platform.
        </p>
      </section>
    </SectionPageShell>
  );
}
