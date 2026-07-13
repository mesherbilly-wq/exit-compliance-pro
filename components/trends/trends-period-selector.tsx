"use client";

import type { TrendsPeriodPreset } from "@/lib/analytics/trends-period";

const PERIOD_OPTIONS: Array<{ value: TrendsPeriodPreset; label: string }> = [
  { value: "last-import", label: "Last Import" },
  { value: "last-24-hours", label: "Last 24 Hours" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "all-time", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

type TrendsPeriodSelectorProps = {
  period: TrendsPeriodPreset;
  customStart: string;
  customEnd: string;
  activeLabel: string | null;
  comparisonLabel: string | null;
  validationError: string | null;
  onPeriodChange: (period: TrendsPeriodPreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onApplyCustom: () => void;
  onClearCustom: () => void;
};

export function TrendsPeriodSelector({
  period,
  customStart,
  customEnd,
  activeLabel,
  comparisonLabel,
  validationError,
  onPeriodChange,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
  onClearCustom,
}: TrendsPeriodSelectorProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Reporting period</h3>
          {activeLabel ? (
            <p className="mt-1 text-sm text-cyan-300">{activeLabel}</p>
          ) : null}
          {comparisonLabel ? (
            <p className="mt-1 text-xs text-slate-400">
              Compared with: {comparisonLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                period === option.value
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "bg-slate-950 text-slate-300 ring-1 ring-slate-700 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {period === "custom" ? (
        <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <label className="block text-sm">
            <span className="text-slate-400">Start date</span>
            <input
              type="date"
              value={customStart}
              onChange={(event) => onCustomStartChange(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">End date</span>
            <input
              type="date"
              value={customEnd}
              onChange={(event) => onCustomEndChange(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <button
            type="button"
            onClick={onApplyCustom}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            Apply
          </button>

          <button
            type="button"
            onClick={onClearCustom}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
          >
            Clear
          </button>
        </div>
      ) : null}

      {validationError ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {validationError}
        </p>
      ) : null}
    </section>
  );
}
