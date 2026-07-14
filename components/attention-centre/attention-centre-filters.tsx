"use client";

import type { AttentionCentreFilters } from "@/lib/analytics/attention-centre/types";
import type { AttentionCentreDashboard } from "@/lib/analytics/attention-centre/types";

type AttentionCentreFiltersProps = {
  dashboard: AttentionCentreDashboard;
  filters: AttentionCentreFilters;
  onChange: (filters: AttentionCentreFilters) => void;
};

export function AttentionCentreFiltersBar({
  dashboard,
  filters,
  onChange,
}: AttentionCentreFiltersProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h3 className="text-lg font-semibold text-white">Filters</h3>
      <p className="mt-1 text-sm text-slate-400">
        Narrow attention items by risk, door, building, or date.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="block text-sm">
          <span className="text-slate-400">Risk</span>
          <select
            value={filters.risk}
            onChange={(event) =>
              onChange({
                ...filters,
                risk: event.target.value as AttentionCentreFilters["risk"],
              })
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="All">All risks</option>
            {dashboard.filterOptions.risks.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Door</span>
          <select
            value={filters.door}
            onChange={(event) =>
              onChange({ ...filters, door: event.target.value })
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="All">All doors</option>
            {dashboard.filterOptions.doors.map((door) => (
              <option key={door} value={door}>
                {door}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Building</span>
          <select
            value={filters.building}
            onChange={(event) =>
              onChange({ ...filters, building: event.target.value })
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="All">All buildings</option>
            {dashboard.filterOptions.buildings.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">From</span>
          <input
            type="date"
            value={filters.dateFrom}
            min={dashboard.filterOptions.dateRange.min}
            max={dashboard.filterOptions.dateRange.max}
            onChange={(event) =>
              onChange({ ...filters, dateFrom: event.target.value })
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">To</span>
          <input
            type="date"
            value={filters.dateTo}
            min={dashboard.filterOptions.dateRange.min}
            max={dashboard.filterOptions.dateRange.max}
            onChange={(event) =>
              onChange({ ...filters, dateTo: event.target.value })
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
      </div>
    </section>
  );
}
