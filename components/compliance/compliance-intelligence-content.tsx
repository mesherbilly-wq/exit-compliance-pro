"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildComplianceIntelligenceDashboard,
  type ComplianceIntelligenceDashboard,
} from "@/lib/analytics/compliance-intelligence";
import { runFireExitIntelligenceEngine } from "@/lib/analytics/fire-exit-intelligence-engine";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import {
  getFieldMapping,
  getLatestImport,
  getLatestImportData,
} from "@/lib/imports/storage";
import type { ImportRecord } from "@/lib/imports/types";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import type { RiskRating } from "@/lib/analytics/door-intelligence-view";
import {
  AVERAGE_TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_TOOLTIP,
} from "@/lib/analytics/labels";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";

const RISK_STYLES: Record<RiskRating, string> = {
  Low: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Medium: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  High: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

const PRIORITY_STYLES = {
  high: "border-red-500/30 bg-red-500/10 text-red-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  low: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
};

function loadComplianceDashboard(): {
  importRecord: ImportRecord | null;
  dashboard: ComplianceIntelligenceDashboard | null;
} {
  const latest = getLatestImport();
  if (!latest) {
    return { importRecord: null, dashboard: null };
  }

  const rows = getLatestImportData();
  const savedMapping =
    latest.analysisSnapshot?.mapping ?? getFieldMapping(latest.id);

  if (latest.analysisSnapshot?.intelligence) {
    return {
      importRecord: latest,
      dashboard: buildComplianceIntelligenceDashboard(
        latest.analysisSnapshot.intelligence,
      ),
    };
  }

  const mapping = resolveFieldMapping(latest.headers, rows, savedMapping);
  if (
    !mapping.eventTime.trim() ||
    !mapping.eventType.trim() ||
    !mapping.doorName.trim()
  ) {
    return { importRecord: latest, dashboard: null };
  }

  const report = runFireExitIntelligenceEngine(rows, latest.headers, {
    sourceFileName: latest.fileName,
    savedMapping: mapping,
  });

  return {
    importRecord: latest,
    dashboard: buildComplianceIntelligenceDashboard(report),
  };
}

export function ComplianceIntelligenceContent() {
  const [importRecord, setImportRecord] = useState<ImportRecord | null>(null);
  const [dashboard, setDashboard] = useState<ComplianceIntelligenceDashboard | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);

  const reloadDashboard = useCallback(() => {
    const data = loadComplianceDashboard();
    setImportRecord(data.importRecord);
    setDashboard(data.dashboard);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reloadDashboard();
  }, [reloadDashboard]);

  useImportsRefreshed(reloadDashboard);

  const primaryCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
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
  }, [dashboard]);

  const secondaryCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
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
  }, [dashboard]);

  const insightCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      {
        label: "Longest single incident",
        value: dashboard.longestSingleIncidentLabel,
        detail: dashboard.longestSingleIncidentDoor,
      },
      {
        label: "Most improved door",
        value: dashboard.mostImprovedDoor,
      },
      {
        label: "Highest risk door",
        value: dashboard.highestRiskDoor,
      },
      {
        label: "Most common time of day",
        value: dashboard.mostCommonTimeOfDay,
      },
      {
        label: "Most common day of week",
        value: dashboard.mostCommonDayOfWeek,
      },
    ];
  }, [dashboard]);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading compliance intelligence...</p>;
  }

  if (!importRecord) {
    return (
      <ComplianceEmptyState
        title="No fire exit data imported yet"
        message="Upload a Genetec CSV to generate fire exit compliance intelligence."
      >
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </ComplianceEmptyState>
    );
  }

  if (!dashboard) {
    return (
      <ComplianceEmptyState
        title="Field mapping required"
        message="Complete field mapping for your latest import to run compliance intelligence."
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
      </ComplianceEmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {isPreviewOnlyAnalysis(importRecord) && <PreviewDataBanner />}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Fire Exit Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Fire Exit Compliance Intelligence
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Portfolio-level compliance intelligence for{" "}
          <span className="font-medium text-white">{dashboard.sourceFileName}</span>.
          Derived from exposure-weighted analytics, not raw event totals.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            {card.badge ? (
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
            <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
            {card.detail && card.detail !== "N/A" && (
              <p className="mt-1 text-sm text-slate-400">{card.detail}</p>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-xl font-semibold">Recommended actions</h3>
        <p className="mt-1 text-sm text-slate-400">
          Generated from held-open exposure, repeat behaviour, risk rating and temporal patterns.
        </p>

        <div className="mt-6 space-y-3">
          {dashboard.recommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className={`rounded-xl border px-4 py-3 text-sm ${PRIORITY_STYLES[recommendation.priority]}`}
            >
              <p className="font-medium capitalize">{recommendation.priority} priority</p>
              <p className="mt-1">{recommendation.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ComplianceEmptyState({
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
        Fire Exit Compliance Intelligence
      </h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Portfolio compliance intelligence derived from fire exit exposure analytics.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
