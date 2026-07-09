import type { DistributionBucket, TrendPoint } from "@/lib/analytics/types";

type DistributionBarsProps = {
  title: string;
  buckets: DistributionBucket[];
  valueKey?: "count" | "exposureSeconds";
};

export function DistributionBars({
  title,
  buckets,
  valueKey = "count",
}: DistributionBarsProps) {
  const values = buckets.map((bucket) =>
    valueKey === "count" ? bucket.count : bucket.exposureSeconds,
  );
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-4 space-y-2">
        {buckets.map((bucket) => {
          const value =
            valueKey === "count" ? bucket.count : bucket.exposureSeconds;
          const width = `${Math.max(4, (value / max) * 100)}%`;

          return (
            <div key={bucket.label} className="grid grid-cols-[72px_1fr_40px] items-center gap-3">
              <span className="text-xs text-slate-400">{bucket.label}</span>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width }}
                />
              </div>
              <span className="text-right text-xs text-slate-300">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TrendListProps = {
  title: string;
  points: TrendPoint[];
};

export function TrendList({ title, points }: TrendListProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="mt-2 text-sm text-slate-400">No trend data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-4 space-y-2">
        {points.map((point) => (
          <div
            key={point.periodKey}
            className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-sm"
          >
            <span className="text-slate-300">{point.label}</span>
            <span className="text-slate-400">
              {point.heldOpenEvents} violations · {Math.round(point.exposureSeconds)}s exposure
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
