type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
        {title}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-4 text-slate-300">{description}</p>

      <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <p className="text-sm text-slate-400">
          This section is ready for implementation.
        </p>
      </div>
    </div>
  );
}
