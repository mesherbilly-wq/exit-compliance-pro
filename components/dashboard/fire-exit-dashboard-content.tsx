"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLatestImport } from "@/lib/client/latest-import";
import { buildComplianceDashboardFromImport } from "@/lib/analytics/load-compliance-dashboard";
import {
  buildDoorIntelligenceRows,
  getTopHighestRiskDoors,
  type RiskRating,
} from "@/lib/analytics/door-intelligence-view";
import type { DoorHealthStatus } from "@/lib/reports/held-open-detection";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import {
  AVERAGE_TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_TOOLTIP,
} from "@/lib/analytics/labels";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";
import { DoorLink } from "@/components/doors/door-link";

const RISK_STYLES: Record<RiskRating, string> = {
  Low: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Medium: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  High: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

const STATUS_STYLES: Record<DoorHealthStatus, string> = {
  Excellent: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Good: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  "Needs Attention": "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

const PRIORITY_STYLES = {
  high: "border-red-500/30 bg-red-500/10 text-red-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  low: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
};

export function FireExitDashboardContent() {
  const { loadedImport, loaded, reload } = useLatestImport();
  const importRecord = loadedImport?.record ?? null;

  useImportsRefreshed(reload);

  const { dashboard } = useMemo(
    () => buildComplianceDashboardFromImport(importRecord, loadedImport?.rows ?? []),
    [importRecord, loadedImport?.rows],
  );

  const topProblemDoors = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return getTopHighestRiskDoors(
      buildDoorIntelligenceRows(dashboard.intelligence.doors),
      10,
    );
  }, [dashboard]);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  if (!importRecord) {
    return (
      <DashboardEmptyState message="Upload a Genetec fire exit CSV and complete field mapping to populate the dashboard.">
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </DashboardEmptyState>
    );
  }

  if (!dashboard) {
    return (
      <DashboardEmptyState message="Complete field mapping for your latest import to populate compliance metrics.">
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
      </DashboardEmptyState>
    );
  }

  const primaryCards = [
    {
      label: "Overall compliance score",
      value: `${dashboard.overallComplianceScore}%`,
      accent: "text-cyan-400",
    },
    {
      label: "Risk level",
      value: dashboard.riskLevel,
      accent:
        dashboard.riskLevel === "Critical"
          ? "text-red-400"
          : dashboard.riskLevel === "High"
            ? "text-amber-400"
            : "text-emerald-400",
      badge: true,
    },
    {
      label: "Total doors",
      value: dashboard.totalDoors.toLocaleString(),
      accent: "text-white",
    },
    {
      label: "Healthy doors",
      value: dashboard.healthyDoors.toLocaleString(),
      accent: "text-emerald-400",
    },
  ];

  const secondaryCards = [
    {
      label: "Doors requiring attention",
      value: dashboard.doorsRequiringAttention.toLocaleString(),
      accent: "text-amber-400",
    },
    {
      label: "Critical doors",
      value: dashboard.criticalDoors.toLocaleString(),
      accent: "text-red-400",
    },
    {
      label: TIME_BEYOND_THRESHOLD_LABEL,
      value: dashboard.totalExposureLabel,
      accent: "text-red-400",
      title: TIME_BEYOND_THRESHOLD_TOOLTIP,
    },
    {
      label: AVERAGE_TIME_BEYOND_THRESHOLD_LABEL,
      value: dashboard.averageExposurePerDoorLabel,
      accent: "text-white",
    },
  ];

  const insightCards = [
    {
      label: "Longest incident",
      value: dashboard.longestSingleIncidentLabel,
      detailDoor:
        dashboard.longestSingleIncidentDoor !== "N/A"
          ? dashboard.longestSingleIncidentDoor
          : undefined,
    },
    {
      label: "Most-improved door",
      value: dashboard.mostImprovedDoor,
      valueIsDoor: true,
    },
    {
      label: "Highest-risk door",
      value: dashboard.highestRiskDoor,
      valueIsDoor: true,
    },
    {
      label: "Most common incident time",
      value: dashboard.mostCommonTimeOfDay,
    },
    {
      label: "Most common incident day",
      value: dashboard.mostCommonDayOfWeek,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {isPreviewOnlyAnalysis(importRecord) && <PreviewDataBanner />}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Fire Exit Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Portfolio compliance overview for{" "}
          <span className="font-medium text-white">{dashboard.sourceFileName}</span>.
          Derived from exposure-weighted analytics across your monitored fire exits.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-white">Latest monitoring summary</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Source" value={importRecord.fileName} />
          <SummaryItem
            label="Rows analysed"
            value={importRecord.rowCount.toLocaleString()}
          />
          <SummaryItem
            label="Doors in scope"
            value={dashboard.totalDoors.toLocaleString()}
          />
          <SummaryItem
            label="Compliance incidents"
            value={dashboard.intelligence.summary.totalHeldOpenEvents.toLocaleString()}
          />
        </dl>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/attention"
            className="rounded-lg bg-cyan-500/15 px-4 py-2 font-medium text-cyan-300 ring-1 ring-cyan-500/30 hover:bg-cyan-500/25"
          >
            View Attention Centre
          </Link>
          <Link
            href="/imports"
            className="rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:border-cyan-500"
          >
            Manage imports
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            {"badge" in card && card.badge ? (
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${RISK_STYLES[dashboard.riskLevel]}`}
              >
                {card.value}
              </span>
            ) : (
              <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.value}</p>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400" title={card.title}>
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {insightCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {"valueIsDoor" in card && card.valueIsDoor && card.value !== "N/A" ? (
                <DoorLink door={card.value} />
              ) : (
                card.value
              )}
            </p>
            {"detailDoor" in card && card.detailDoor ? (
              <p className="mt-1 text-sm text-slate-400">
                Door: <DoorLink door={card.detailDoor} className="inline text-sm" />
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-xl font-semibold">Recommended actions</h3>
        <p className="mt-1 text-sm text-slate-400">
          Priority recommendations from the compliance engine. See Attention Centre for
          operational follow-up.
        </p>

        <div className="mt-6 space-y-3">
          {dashboard.recommendations.slice(0, 6).map((recommendation) => (
            <div
              key={recommendation.id}
              className={`rounded-xl border px-4 py-3 text-sm ${PRIORITY_STYLES[recommendation.priority]}`}
            >
              <p className="font-medium capitalize">{recommendation.priority} priority</p>
              {recommendation.door ? (
                <p className="mt-1">
                  <DoorLink door={recommendation.door} className="text-sm" />
                </p>
              ) : null}
              <p className="mt-1">{recommendation.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Top problem doors</h3>
          <p className="mt-1 text-sm text-slate-400">
            Highest-risk exits ranked by compliance score, exposure and repeat behaviour.
          </p>
        </div>

        {topProblemDoors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">
              No held-open incidents detected in the current import.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Door</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Incidents</th>
                  <th className="px-4 py-3 font-medium">{TIME_BEYOND_THRESHOLD_LABEL}</th>
                  <th className="px-4 py-3 font-medium">Compliance score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {topProblemDoors.map((door) => (
                  <tr key={door.door} className="border-b border-slate-800">
                    <td className="px-4 py-3 font-medium text-white">
                      <DoorLink door={door.door} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${RISK_STYLES[door.riskRating]}`}
                      >
                        {door.riskRating}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{door.occurrences}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.totalExposureLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.complianceScore}%
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[door.status]}`}
                      >
                        {door.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-white">{value}</dd>
    </div>
  );
}

function DashboardEmptyState({
  message,
  children,
}: {
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
        Fire Exit Intelligence
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">Dashboard</h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Monitor held-open exit events, door health and compliance scoring across your
        fire exit estate.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">No dashboard data available</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
