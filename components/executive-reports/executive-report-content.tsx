"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useLatestImport } from "@/lib/client/latest-import";
import {
  buildExecutiveReport,
  type ExecutiveReport,
  type SiteHealthRating,
} from "@/lib/analytics/executive-report";
import { runFireExitIntelligenceEngine } from "@/lib/analytics/fire-exit-intelligence-engine";
import type { TrendDirection } from "@/lib/analytics/door-intelligence-view";
import type { RiskRating } from "@/lib/analytics/door-intelligence-view";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import type { ImportRecord } from "@/lib/imports/types";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import {
  TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_TOOLTIP,
} from "@/lib/analytics/labels";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";
import { DoorLink } from "@/components/doors/door-link";

const SITE_HEALTH_STYLES: Record<
  SiteHealthRating,
  { badge: string; ring: string; accent: string }
> = {
  Excellent: {
    badge: "bg-emerald-500/15 text-emerald-300",
    ring: "ring-emerald-500/40",
    accent: "text-emerald-400",
  },
  Good: {
    badge: "bg-cyan-500/15 text-cyan-300",
    ring: "ring-cyan-500/40",
    accent: "text-cyan-400",
  },
  Fair: {
    badge: "bg-amber-500/15 text-amber-300",
    ring: "ring-amber-500/40",
    accent: "text-amber-400",
  },
  Poor: {
    badge: "bg-orange-500/15 text-orange-300",
    ring: "ring-orange-500/40",
    accent: "text-orange-400",
  },
  Critical: {
    badge: "bg-red-500/15 text-red-300",
    ring: "ring-red-500/40",
    accent: "text-red-400",
  },
};

const RISK_STYLES: Record<RiskRating, string> = {
  Low: "text-emerald-400",
  Medium: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-red-400",
};

const TREND_STYLES: Record<TrendDirection, string> = {
  Improving: "text-emerald-400",
  Stable: "text-slate-300",
  Deteriorating: "text-red-400",
  "N/A": "text-slate-500",
};

const PRIORITY_STYLES = {
  high: "border-red-500/25 bg-red-500/5",
  medium: "border-amber-500/25 bg-amber-500/5",
  low: "border-cyan-500/25 bg-cyan-500/5",
};

function buildExecutiveReportData(
  latest: ImportRecord | null,
  rows: Record<string, string>[],
): {
  importRecord: ImportRecord | null;
  report: ExecutiveReport | null;
} {
  if (!latest) {
    return { importRecord: null, report: null };
  }

  const savedMapping = latest.analysisSnapshot?.mapping ?? null;

  if (latest.analysisSnapshot?.intelligence) {
    return {
      importRecord: latest,
      report: buildExecutiveReport(latest.analysisSnapshot.intelligence),
    };
  }

  const mapping = resolveFieldMapping(latest.headers, rows, savedMapping);
  if (
    !mapping.eventTime.trim() ||
    !mapping.eventType.trim() ||
    !mapping.doorName.trim()
  ) {
    return { importRecord: latest, report: null };
  }

  const intelligence = runFireExitIntelligenceEngine(rows, latest.headers, {
    sourceFileName: latest.fileName,
    savedMapping: mapping,
  });

  return {
    importRecord: latest,
    report: buildExecutiveReport(intelligence),
  };
}

export function ExecutiveReportContent() {
  const { loadedImport, loaded, reload } = useLatestImport();
  const { importRecord, report } = useMemo(
    () =>
      buildExecutiveReportData(
        loadedImport?.record ?? null,
        loadedImport?.rows ?? [],
      ),
    [loadedImport],
  );

  useImportsRefreshed(reload);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Preparing management review...</p>;
  }

  if (!importRecord) {
    return (
      <ExecutiveEmptyState
        title="No fire exit data imported yet"
        message="Upload a Genetec CSV to generate a management summary."
      >
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </ExecutiveEmptyState>
    );
  }

  if (!report) {
    return (
      <ExecutiveEmptyState
        title="Field mapping required"
        message="Complete field mapping for your latest import to generate the management review."
      >
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/imports/mapping"
            className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Field mapping
          </Link>
        </div>
      </ExecutiveEmptyState>
    );
  }

  const healthStyle = SITE_HEALTH_STYLES[report.siteHealthRating];

  return (
    <div className="mx-auto max-w-5xl">
      {isPreviewOnlyAnalysis(importRecord) && (
        <div className="mb-6">
          <PreviewDataBanner />
        </div>
      )}

      <article className="overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-black/30">
        <header className="border-b border-slate-800 bg-slate-900/80 px-8 py-8 sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Fire Exit Intelligence Platform
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Management Review
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                One-page management summary for directors and facilities managers
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Report date
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {report.reportDateLabel}
              </p>
              <p className="mt-2 text-xs text-slate-500">{report.sourceFileName}</p>
            </div>
          </div>
        </header>

        <div className="space-y-8 px-8 py-8 sm:px-10">
          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-sm font-medium text-slate-400">
                Overall compliance score
              </p>
              <div className="mt-4 flex items-end gap-4">
                <p className="text-6xl font-bold tabular-nums text-white">
                  {report.overallComplianceScore}
                  <span className="text-3xl text-slate-400">%</span>
                </p>
                <div className="mb-2">
                  <p
                    className={`text-sm font-semibold ${TREND_STYLES[report.complianceTrend.direction]}`}
                  >
                    {report.complianceTrend.direction}
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    {report.complianceTrend.label}
                  </p>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                  style={{ width: `${report.overallComplianceScore}%` }}
                />
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Data period: {report.dataPeriodLabel}
              </p>
            </div>

            <div
              className={`flex flex-col justify-between rounded-2xl border p-6 ring-1 ${healthStyle.ring} border-slate-800 bg-slate-900/60`}
            >
              <div>
                <p className="text-sm font-medium text-slate-400">
                  Site health rating
                </p>
                <span
                  className={`mt-4 inline-flex rounded-full px-4 py-1.5 text-lg font-bold ${healthStyle.badge}`}
                >
                  {report.siteHealthRating}
                </span>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  {report.siteHealthSummary}
                </p>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Total doors</dt>
                  <dd className="font-semibold text-white">{report.totalDoors}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Healthy</dt>
                  <dd className="font-semibold text-emerald-400">
                    {report.healthyDoors}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Attention</dt>
                  <dd className="font-semibold text-amber-400">
                    {report.doorsRequiringAttention}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Critical</dt>
                  <dd className="font-semibold text-red-400">
                    {report.criticalDoors}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Compliance trend"
              value={report.complianceTrend.direction}
              detail={report.complianceTrend.label}
              valueClass={TREND_STYLES[report.complianceTrend.direction]}
            />
            <MetricTile
              label="Highest risk door"
              value={report.highestRiskDoor}
              detail={report.highestRiskDoorDetail}
              valueClass="text-base font-semibold text-white"
              compact
              door={
                report.highestRiskDoor !== "N/A"
                  ? report.highestRiskDoor
                  : undefined
              }
            />
            <MetricTile
              label={TIME_BEYOND_THRESHOLD_LABEL}
              value={report.totalExposureLabel}
              detail={TIME_BEYOND_THRESHOLD_TOOLTIP}
              valueClass="text-2xl font-bold text-red-400"
            />
            <MetricTile
              label="Critical incidents"
              value={report.criticalIncidents.toLocaleString()}
              detail={report.criticalIncidentsLabel}
              valueClass="text-3xl font-bold text-amber-400"
            />
          </section>

          {report.complianceTrend.recentPeriods.length > 1 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Weekly time beyond threshold trend
              </h2>
              <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-2">
                {report.complianceTrend.recentPeriods.map((point) => {
                  const maxExposure = Math.max(
                    ...report.complianceTrend.recentPeriods.map(
                      (entry) => entry.exposureSeconds,
                    ),
                    1,
                  );
                  const height = Math.max(
                    8,
                    (point.exposureSeconds / maxExposure) * 72,
                  );

                  return (
                    <div
                      key={point.periodKey}
                      className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400"
                        style={{ height: `${height}px` }}
                        title={`${point.label}: ${formatDurationLabel(point.exposureSeconds)} beyond threshold`}
                      />
                      <span className="text-[10px] text-slate-500">
                        {point.label.replace(/^\d{4}-W/, "W")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-lg font-semibold text-white">
                Top 5 compliance risks
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Highest priority fire exits by risk rating and time beyond threshold
              </p>

              {report.topComplianceRisks.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  No compliance risks identified in the analysed period.
                </p>
              ) : (
                <ol className="mt-6 space-y-3">
                  {report.topComplianceRisks.map((item) => (
                    <li
                      key={item.door}
                      className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-sm font-bold text-red-400">
                        {item.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">
                            <DoorLink door={item.door} />
                          </p>
                          <span
                            className={`text-xs font-semibold ${RISK_STYLES[item.riskRating]}`}
                          >
                            {item.riskRating}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{item.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.complianceScore}% compliance · Trend:{" "}
                          <span className={TREND_STYLES[item.trend]}>
                            {item.trend}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-lg font-semibold text-white">
                Top 5 improvements
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Exits showing improving trends or strong compliance performance
              </p>

              {report.topImprovements.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  No improving exits identified yet.
                </p>
              ) : (
                <ol className="mt-6 space-y-3">
                  {report.topImprovements.map((item) => (
                    <li
                      key={item.door}
                      className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-400">
                        {item.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">
                            <DoorLink door={item.door} />
                          </p>
                          <span
                            className={`text-xs font-semibold ${TREND_STYLES[item.trend]}`}
                          >
                            {item.trend}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{item.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.complianceScore}% compliance · {item.exposureLabel}{" "}
                          beyond threshold
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">
              Operational recommendations
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Prioritised actions derived from fire exit analytics
            </p>

            <div className="mt-6 space-y-3">
              {report.operationalRecommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className={`rounded-xl border px-4 py-3 ${PRIORITY_STYLES[recommendation.priority]}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {recommendation.priority} priority
                  </p>
                  {recommendation.door && (
                    <p className="mt-1 text-sm">
                      <DoorLink door={recommendation.door} className="text-sm" />
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-200">
                    {recommendation.message}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-800 bg-slate-950/80 px-8 py-5 sm:px-10">
          <p className="text-xs text-slate-500">
            Generated client-side from fire exit intelligence analytics ·{" "}
            {report.analyzedAt
              ? `Analysis snapshot: ${formatReportDate(report.analyzedAt)}`
              : report.reportDateLabel}
            {" · "}
            This layout is designed for future PDF export.
          </p>
        </footer>
      </article>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  valueClass,
  compact = false,
  door,
}: {
  label: string;
  value: string;
  detail: string;
  valueClass: string;
  compact?: boolean;
  door?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {door ? (
        <div className={`mt-2 truncate ${compact ? "text-base" : ""}`}>
          <DoorLink door={door} />
        </div>
      ) : (
        <p
          className={`mt-2 truncate ${compact ? "text-base" : ""} ${valueClass}`}
          title={value}
        >
          {value}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{detail}</p>
    </div>
  );
}

function formatReportDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ExecutiveEmptyState({
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
      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        Management Review
      </h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        One-page management summary for directors and facilities managers.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
