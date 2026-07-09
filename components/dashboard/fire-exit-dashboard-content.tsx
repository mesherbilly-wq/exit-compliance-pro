"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toFireExitDashboardAnalysis } from "@/lib/analytics/report-adapters";
import {
  analyzeFireExitDashboard,
  canRunFireExitDashboard,
} from "@/lib/reports/analyze-fire-exit-dashboard";
import type { FireExitDashboardAnalysis } from "@/lib/reports/analyze-fire-exit-dashboard";
import type { DoorComplianceStatus } from "@/lib/reports/held-open-detection";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import {
  getFieldMapping,
  getLatestImport,
  getLatestImportData,
} from "@/lib/imports/storage";
import type { FieldMapping, ImportRecord } from "@/lib/imports/types";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import {
  TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_TOOLTIP,
} from "@/lib/analytics/labels";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";

const STATUS_STYLES: Record<DoorComplianceStatus, string> = {
  Compliant: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Warning: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

export function FireExitDashboardContent() {
  const [importRecord, setImportRecord] = useState<ImportRecord | null>(null);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reloadImportState = useCallback(() => {
    const latest = getLatestImport();
    const rows = getLatestImportData();
    setImportRecord(latest);
    setMapping(
      latest
        ? resolveFieldMapping(latest.headers, rows, getFieldMapping(latest.id))
        : null,
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    reloadImportState();
  }, [reloadImportState]);

  useImportsRefreshed(reloadImportState);

  const rows = useMemo(() => getLatestImportData(), [loaded, importRecord]);

  const analysis = useMemo<FireExitDashboardAnalysis | null>(() => {
    if (!importRecord || !mapping) {
      return null;
    }

    if (importRecord.analysisSnapshot?.intelligence) {
      return toFireExitDashboardAnalysis(importRecord.analysisSnapshot.intelligence);
    }

    if (!canRunFireExitDashboard(rows, mapping)) {
      return null;
    }

    return analyzeFireExitDashboard(
      rows,
      mapping,
      importRecord.headers,
      importRecord.fileName,
    );
  }, [importRecord, mapping, rows]);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  if (!importRecord) {
    return (
      <DashboardEmptyState message="Upload a Genetec fire exit CSV and complete field mapping to populate the compliance dashboard.">
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </DashboardEmptyState>
    );
  }

  if (!analysis) {
    return (
      <DashboardEmptyState message="Complete field mapping for your latest import to populate held-open compliance metrics.">
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

  const kpiCards = [
    {
      label: "Overall Compliance Score",
      value: `${analysis.overallComplianceScore}%`,
      accent: "text-cyan-400",
    },
    {
      label: "Doors Monitored",
      value: analysis.doorsMonitored.toLocaleString(),
      accent: "text-white",
    },
    {
      label: "Events Analysed",
      value: analysis.eventsAnalysed.toLocaleString(),
      accent: "text-white",
    },
    {
      label: "Held-open Violations",
      value: analysis.heldOpenEvents.toLocaleString(),
      accent: "text-amber-400",
    },
    {
      label: TIME_BEYOND_THRESHOLD_LABEL,
      value: analysis.totalExposureLabel ?? "N/A",
      accent: "text-red-400",
      title: TIME_BEYOND_THRESHOLD_TOOLTIP,
    },
    {
      label: "Average Violation Duration",
      value: analysis.averageOpenDurationLabel,
      accent: "text-white",
    },
    {
      label: "Worst Performing Door",
      value: analysis.worstPerformingDoor,
      accent: "text-red-400",
      small: true,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {isPreviewOnlyAnalysis(importRecord) && <PreviewDataBanner />}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Fire Exit Intelligence
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Intelligence Dashboard
          </h2>
          <p className="mt-4 max-w-3xl text-slate-300">
            Exposure-weighted held-open intelligence for{" "}
            <span className="font-medium text-white">
              {analysis.sourceFileName}
            </span>
            . Focused on life safety exceptions only.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-500"
        >
          Export Executive Report
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400" title={"title" in card ? card.title : undefined}>
              {card.label}
            </p>
            <p
              className={`mt-2 font-bold ${card.accent} ${
                card.small ? "text-lg" : "text-3xl"
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Top problem doors</h3>
          <p className="mt-1 text-sm text-slate-400">
            Exit doors ranked by held-open events and compliance score.
          </p>
        </div>

        {analysis.problemDoors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">
              No held-open events detected in the current import.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Door name</th>
                  <th className="px-4 py-3 font-medium">Held-open events</th>
                  <th className="px-4 py-3 font-medium">Average duration</th>
                  <th className="px-4 py-3 font-medium">Longest duration</th>
                  <th className="px-4 py-3 font-medium">Compliance score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {analysis.problemDoors.map((door) => (
                  <tr key={door.door} className="border-b border-slate-800">
                    <td className="px-4 py-3 font-medium text-white">
                      {door.door}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.heldOpenEvents}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.averageDurationLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.longestDurationLabel}
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

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Recent exceptions</h3>
          <p className="mt-1 text-sm text-slate-400">
            Latest held-open fire exit events requiring review.
          </p>
        </div>

        {analysis.recentExceptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">
              No recent held-open exceptions found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Event time</th>
                  <th className="px-4 py-3 font-medium">Door name</th>
                  <th className="px-4 py-3 font-medium">Event type</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {analysis.recentExceptions.map((event, index) => (
                  <tr key={index} className="border-b border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {event.time}
                    </td>
                    <td className="px-4 py-3 text-white">{event.door}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {event.eventType}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {event.durationLabel}
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
        Fire Exit Compliance
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        Fire Exit Compliance Dashboard
      </h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Monitor held-open exit events, door health and compliance scoring across
        your fire exit estate.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">No dashboard data available</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
