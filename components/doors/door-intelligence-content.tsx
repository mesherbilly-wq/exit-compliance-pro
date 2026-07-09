"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildDoorIntelligenceRows,
  getDoorHighlightType,
  getTopDeterioratingDoors,
  getTopHighestRiskDoors,
  getTopImprovingDoors,
  sortDoorIntelligenceRows,
  type DoorIntelligenceRow,
  type DoorIntelligenceSortKey,
  type RiskRating,
  type TrendDirection,
} from "@/lib/analytics/door-intelligence-view";
import {
  TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_TOOLTIP,
} from "@/lib/analytics/labels";
import { loadLatestDoorHealthData } from "@/lib/imports/door-health-loader";
import type { DoorHealthAnalysis } from "@/lib/reports/analyze-door-health";
import type { DoorHealthStatus } from "@/lib/reports/held-open-detection";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import type { ImportRecord } from "@/lib/imports/types";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";

const STATUS_STYLES: Record<DoorHealthStatus, string> = {
  Excellent: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Good: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  "Needs Attention": "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

const RISK_STYLES: Record<RiskRating, string> = {
  Low: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Medium: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  High: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

const TREND_STYLES: Record<TrendDirection, string> = {
  Improving: "text-emerald-400",
  Deteriorating: "text-red-400",
  Stable: "text-slate-300",
  "N/A": "text-slate-500",
};

const HIGHLIGHT_ROW_STYLES = {
  "highest-risk": "bg-red-500/5 ring-1 ring-inset ring-red-500/20",
  improving: "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/20",
  deteriorating: "bg-amber-500/5 ring-1 ring-inset ring-amber-500/20",
};

const COLUMNS: {
  key: DoorIntelligenceSortKey;
  label: string;
  title?: string;
}[] = [
  { key: "door", label: "Door name" },
  { key: "complianceScore", label: "Compliance score" },
  { key: "riskRating", label: "Risk rating" },
  {
    key: "totalExposureSeconds",
    label: TIME_BEYOND_THRESHOLD_LABEL,
    title: TIME_BEYOND_THRESHOLD_TOOLTIP,
  },
  { key: "averageHeldOpenDurationSeconds", label: "Average held open duration" },
  { key: "longestHeldOpenDurationSeconds", label: "Longest held open duration" },
  { key: "occurrences", label: "Occurrences" },
  { key: "daysAffected", label: "Days affected" },
  { key: "lastIncidentTimestamp", label: "Last incident" },
  { key: "trend", label: "Trend" },
  { key: "status", label: "Status" },
];

export function DoorIntelligenceContent() {
  const pathname = usePathname();
  const [importRecord, setImportRecord] = useState<ImportRecord | null>(null);
  const [analysis, setAnalysis] = useState<DoorHealthAnalysis | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<DoorIntelligenceSortKey>("riskRating");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const reloadData = useCallback(() => {
    const data = loadLatestDoorHealthData();
    setImportRecord(data.importRecord);
    setAnalysis(data.analysis);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reloadData();
  }, [pathname, reloadData]);

  useImportsRefreshed(reloadData);

  const rows = useMemo(() => {
    if (!analysis) {
      return [];
    }

    return buildDoorIntelligenceRows(analysis.intelligence.doors);
  }, [analysis]);

  const highestRisk = useMemo(() => getTopHighestRiskDoors(rows), [rows]);
  const improving = useMemo(() => getTopImprovingDoors(rows), [rows]);
  const deteriorating = useMemo(() => getTopDeterioratingDoors(rows), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searched = query
      ? rows.filter((row) => row.door.toLowerCase().includes(query))
      : rows;

    return sortDoorIntelligenceRows(searched, sortKey, sortDirection);
  }, [rows, search, sortKey, sortDirection]);

  function handleSort(column: DoorIntelligenceSortKey) {
    if (sortKey === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(column);
    setSortDirection(column === "door" || column === "status" ? "asc" : "desc");
  }

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading door intelligence...</p>;
  }

  if (!importRecord) {
    return (
      <DoorIntelligenceEmptyState
        title="No fire exit data imported yet"
        message="Upload a Genetec CSV to start analysing fire exit door intelligence."
      >
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </DoorIntelligenceEmptyState>
    );
  }

  if (!analysis) {
    return (
      <DoorIntelligenceEmptyState
        title="Field mapping required"
        message="Complete field mapping for your latest import to run door intelligence analysis."
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
      </DoorIntelligenceEmptyState>
    );
  }

  const summary = analysis.intelligence.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {isPreviewOnlyAnalysis(importRecord) && <PreviewDataBanner />}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Fire Exit Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Door Intelligence</h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Operational door intelligence for{" "}
          <span className="font-medium text-white">{analysis.sourceFileName}</span>.
          Ranked by exposure-weighted risk, repeat behaviour and recent trend direction.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Fire exits monitored" value={summary.totalDoors.toLocaleString()} accent="text-white" />
        <SummaryCard label="Doors with violations" value={summary.doorsWithViolations.toLocaleString()} accent="text-amber-400" />
        <SummaryCard
          label={TIME_BEYOND_THRESHOLD_LABEL}
          value={summary.totalExposureLabel}
          accent="text-red-400"
          title={TIME_BEYOND_THRESHOLD_TOOLTIP}
        />
        <SummaryCard label="Portfolio score" value={`${summary.overallComplianceScore}%`} accent="text-cyan-400" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <HighlightPanel
          title="Top 10 highest risk"
          subtitle="Highest time beyond threshold and risk rating"
          doors={highestRisk}
          emptyMessage="No held-open violations detected."
          tone="red"
        />
        <HighlightPanel
          title="Top 10 improving"
          subtitle="Recent weekly trend improving"
          doors={improving}
          emptyMessage="No improving doors in this period."
          tone="emerald"
        />
        <HighlightPanel
          title="Top 10 deteriorating"
          subtitle="Recent weekly trend deteriorating"
          doors={deteriorating}
          emptyMessage="No deteriorating doors in this period."
          tone="amber"
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Door intelligence register</h3>
            <p className="mt-1 text-sm text-slate-400">
              Showing {filteredRows.length} of {rows.length} fire exits. Click any column header to sort.
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <label htmlFor="door-search" className="text-sm font-medium text-slate-300">
              Search doors
            </label>
            <input
              id="door-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by door name..."
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-300">
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-1 hover:text-white"
                      title={column.title}
                    >
                      {column.label}
                      {sortKey === column.key && (
                        <span className="text-cyan-400">
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-slate-400">
                    No doors match your search filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const highlight = getDoorHighlightType(
                    row.door,
                    highestRisk,
                    improving,
                    deteriorating,
                  );

                  return (
                    <tr
                      key={row.door}
                      className={`border-b border-slate-800 last:border-0 ${
                        highlight ? HIGHLIGHT_ROW_STYLES[highlight] : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{row.door}</td>
                      <td className="px-4 py-3 text-slate-300">{row.complianceScore}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${RISK_STYLES[row.riskRating]}`}
                        >
                          {row.riskRating}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.totalExposureLabel}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.averageHeldOpenDurationLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.longestHeldOpenDurationLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.occurrences}</td>
                      <td className="px-4 py-3 text-slate-300">{row.daysAffected}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                        {row.lastIncident}
                      </td>
                      <td className={`px-4 py-3 font-medium ${TREND_STYLES[row.trend]}`}>
                        {row.trend}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  title,
}: {
  label: string;
  value: string;
  accent: string;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400" title={title}>
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function HighlightPanel({
  title,
  subtitle,
  doors,
  emptyMessage,
  tone,
}: {
  title: string;
  subtitle: string;
  doors: DoorIntelligenceRow[];
  emptyMessage: string;
  tone: "red" | "emerald" | "amber";
}) {
  const titleStyles = {
    red: "text-red-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className={`text-lg font-semibold ${titleStyles[tone]}`}>{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

      {doors.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {doors.map((door, index) => (
            <li
              key={door.door}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {index + 1}. {door.door}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {door.riskRating} risk · {door.totalExposureLabel} beyond threshold · {door.trend}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{door.complianceScore}%</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DoorIntelligenceEmptyState({
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
      <h2 className="mt-3 text-3xl font-bold tracking-tight">Door Intelligence</h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Operational intelligence for fire exit held-open exposure, risk and trend behaviour.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
