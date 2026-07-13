type SimpleTrendChartProps = {
  title: string;
  points: Array<{ label: string; value: number }>;
  valueSuffix?: string;
  accentClassName?: string;
  emptyMessage?: string;
};

export function SimpleTrendChart({
  title,
  points,
  valueSuffix = "",
  accentClassName = "stroke-cyan-400 fill-cyan-500/20",
  emptyMessage = "No trend data available for this period.",
}: SimpleTrendChartProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="mt-3 text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const width = 640;
  const height = 180;
  const padding = { top: 16, right: 16, bottom: 36, left: 16 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);

  const coordinates = points.map((point, index) => {
    const x =
      padding.left +
      (points.length === 1
        ? chartWidth / 2
        : (index / (points.length - 1)) * chartWidth);
    const y =
      padding.top +
      chartHeight -
      ((point.value - minValue) / range) * chartHeight;

    return { x, y, ...point };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? padding.left} ${
    padding.top + chartHeight
  } L ${coordinates[0]?.x ?? padding.left} ${padding.top + chartHeight} Z`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-full"
          role="img"
          aria-label={title}
        >
          <path d={areaPath} className={accentClassName.split(" ")[1]} />
          <path
            d={linePath}
            fill="none"
            className={accentClassName.split(" ")[0]}
            strokeWidth="2.5"
          />
          {coordinates.map((point) => (
            <g key={point.label}>
              <circle
                cx={point.x}
                cy={point.y}
                r="3.5"
                className="fill-cyan-300"
              />
              <text
                x={point.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {point.label}
              </text>
              <title>
                {point.label}: {point.value}
                {valueSuffix}
              </title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

type IncidentTrendChartProps = {
  title: string;
  points: Array<{ label: string; heldOpenEvents: number; exposureSeconds: number }>;
  mode?: "incidents" | "exposure";
};

export function IncidentTrendChart({
  title,
  points,
  mode = "incidents",
}: IncidentTrendChartProps) {
  return (
    <SimpleTrendChart
      title={title}
      points={points.map((point) => ({
        label: point.label,
        value: mode === "incidents" ? point.heldOpenEvents : point.exposureSeconds,
      }))}
      valueSuffix={mode === "incidents" ? " incidents" : "s"}
      accentClassName={
        mode === "incidents"
          ? "stroke-cyan-400 fill-cyan-500/20"
          : "stroke-amber-400 fill-amber-500/20"
      }
    />
  );
}
