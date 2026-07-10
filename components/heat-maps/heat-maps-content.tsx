"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useLatestImport } from "@/lib/client/latest-import";
import {
  buildHeatMapDashboard,
  DEFAULT_HEAT_MAP_FILTERS,
  type HeatMapDashboard,
  type HeatMapFilterState,
} from "@/lib/analytics/heat-maps";
import { runFireExitIntelligenceEngine } from "@/lib/analytics/fire-exit-intelligence-engine";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import {
  getFieldMapping,
} from "@/lib/imports/storage";
import type { ImportRecord } from "@/lib/imports/types";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import type { FireExitIntelligenceReport } from "@/lib/analytics/types";
import type { RiskRating } from "@/lib/analytics/door-intelligence-view";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import { TIME_BEYOND_THRESHOLD_LABEL } from "@/lib/analytics/labels";
import { HeatMapGridView } from "@/components/heat-maps/heat-map-grid";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";

const RISK_LEVELS: Array<RiskRating | "All"> = [
  "All",
  "Low",
  "Medium",
  "High",
  "Critical",
];

function buildHeatMapSource(
  latest: ImportRecord | null,
  rows: Record<string, string>[],
): {
  importRecord: ImportRecord | null;
  report: FireExitIntelligenceReport | null;
  rows: Record<string, string>[];
} {
  if (!latest) {
    return { importRecord: null, report: null, rows: [] };
  }

  const savedMapping =
    latest.analysisSnapshot?.mapping ?? getFieldMapping(latest.id);

  if (latest.analysisSnapshot?.intelligence) {
    return {
      importRecord: latest,
      report: latest.analysisSnapshot.intelligence,
      rows,
    };
  }

  const mapping = resolveFieldMapping(latest.headers, rows, savedMapping);
  if (
    !mapping.eventTime.trim() ||
    !mapping.eventType.trim() ||
    !mapping.doorName.trim()
  ) {
    return { importRecord: latest, report: null, rows };
  }

  const report = runFireExitIntelligenceEngine(rows, latest.headers, {
    sourceFileName: latest.fileName,
    savedMapping: mapping,
  });

  return { importRecord: latest, report, rows };
}

export function HeatMapsContent() {
  const { loadedImport, loaded, reload } = useLatestImport();
  const source = useMemo(
    () => buildHeatMapSource(loadedImport?.record ?? null, loadedImport?.rows ?? []),
    [loadedImport],
  );
  const importRecord = source.importRecord;
  const report = source.report;
  const rows = source.rows;
  const [filters, setFilters] = useState<HeatMapFilterState>(
    DEFAULT_HEAT_MAP_FILTERS,
  );

  useImportsRefreshed(reload);

  const dashboard = useMemo<HeatMapDashboard | null>(() => {
    if (!report) {
      return null;
    }

    return buildHeatMapDashboard(
      report,
      rows,
      importRecord?.headers ?? [],
      filters,
    );
  }, [report, rows, filters, importRecord?.headers]);

  const summaryCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      {
        label: "Filtered incidents",
        value: dashboard.totalIncidents.toLocaleString(),
      },
      {
        label: "Doors with incidents",
        value: dashboard.doorsWithIncidents.toLocaleString(),
      },
      {
        label: `${TIME_BEYOND_THRESHOLD_LABEL} in view`,
        value: formatDurationLabel(dashboard.totalExposureSeconds),
      },
      {
        label: "Doors in scope",
        value: dashboard.filterOptions.doors.length.toLocaleString(),
      },
    ];
  }, [dashboard]);

  function updateFilter<K extends keyof HeatMapFilterState>(
    key: K,
    value: HeatMapFilterState[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    if (!dashboard) {
      setFilters(DEFAULT_HEAT_MAP_FILTERS);
      return;
    }

    setFilters({
      ...DEFAULT_HEAT_MAP_FILTERS,
      dateFrom: dashboard.filterOptions.dateRange.min,
      dateTo: dashboard.filterOptions.dateRange.max,
    });
  }

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading heat maps...</p>;
  }

  if (!importRecord) {
    return (
      <HeatMapsEmptyState
        title="No fire exit data imported yet"
        message="Upload a Genetec CSV to generate operational heat maps from fire exit events."
      >
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </HeatMapsEmptyState>
    );
  }

  if (!report || !dashboard) {
    return (
      <HeatMapsEmptyState
        title="Field mapping required"
        message="Complete field mapping for your latest import to generate heat maps."
      >
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/imports/mapping"
            className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Field mapping
          </Link>
          <Link
            href="/imports/upload"
            className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-500"
          >
            Upload new CSV
          </Link>
        </div>
      </HeatMapsEmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {isPreviewOnlyAnalysis(importRecord) && <PreviewDataBanner />}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Fire Exit Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Operational Heat Maps</h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Interactive intensity grids derived from merged compliance incidents for{" "}
          <span className="font-medium text-white">{dashboard.sourceFileName}</span>.
          Busier periods appear with stronger colour intensity.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Filters</h3>
            <p className="mt-1 text-sm text-slate-400">
              Narrow heat maps by date, door, building, or risk level.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-500"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <FilterField label="Date from">
            <input
              type="date"
              value={filters.dateFrom}
              min={dashboard.filterOptions.dateRange.min || undefined}
              max={filters.dateTo || dashboard.filterOptions.dateRange.max || undefined}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </FilterField>

          <FilterField label="Date to">
            <input
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || dashboard.filterOptions.dateRange.min || undefined}
              max={dashboard.filterOptions.dateRange.max || undefined}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </FilterField>

          <FilterField label="Door">
            <select
              value={filters.door}
              onChange={(event) => updateFilter("door", event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="All">All doors</option>
              {dashboard.filterOptions.doors.map((door) => (
                <option key={door} value={door}>
                  {door}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Building">
            <select
              value={filters.building}
              onChange={(event) => updateFilter("building", event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="All">All buildings</option>
              {dashboard.filterOptions.buildings.map((building) => (
                <option key={building} value={building}>
                  {building}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Risk level">
            <select
              value={filters.riskLevel}
              onChange={(event) =>
                updateFilter("riskLevel", event.target.value as RiskRating | "All")
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {RISK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === "All" ? "All risk levels" : level}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <HeatMapGridView grid={dashboard.hourOfDay} />
        <HeatMapGridView grid={dashboard.dayOfWeek} />
      </div>

      <HeatMapGridView grid={dashboard.doorActivity} compact />
      <HeatMapGridView grid={dashboard.exposureTime} compact />
      <HeatMapGridView grid={dashboard.highRiskDoors} compact />
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function HeatMapsEmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
        Fire Exit Intelligence
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">Operational Heat Maps</h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Interactive intensity grids for fire exit operational patterns.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
