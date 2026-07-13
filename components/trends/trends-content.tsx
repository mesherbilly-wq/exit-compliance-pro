"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrendDirection } from "@/lib/analytics/door-intelligence-view";
import type { RiskRating } from "@/lib/analytics/door-intelligence-view";
import type { TrendsPeriodPreset } from "@/lib/analytics/trends-period";
import type { TrendsDashboard } from "@/lib/analytics/trends-dashboard";
import { TIME_BEYOND_THRESHOLD_LABEL } from "@/lib/analytics/labels";
import { fetchTrendsDashboard } from "@/lib/client/trends-api";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";
import { DoorLink } from "@/components/doors/door-link";
import { SectionPageShell } from "@/components/ui/section-page-shell";
import {
  IncidentTrendChart,
  SimpleTrendChart,
} from "@/components/trends/simple-trend-chart";
import { TrendsPeriodSelector } from "@/components/trends/trends-period-selector";

const TREND_STYLES: Record<TrendDirection, string> = {
  Improving: "text-emerald-400",
  Stable: "text-slate-300",
  Deteriorating: "text-red-400",
  "N/A": "text-slate-500",
};

const RISK_STYLES: Record<RiskRating, string> = {
  Low: "text-emerald-400",
  Medium: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-red-400",
};

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ComparisonNote({ available }: { available: boolean }) {
  if (available) {
    return null;
  }

  return (
    <p className="mb-4 text-sm text-slate-500">
      Previous period comparison is not available for this selection.
    </p>
  );
}

function formatSignedPoints(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value} percentage points`;
}

function formatSignedCount(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}`;
}

export function TrendsContent() {
  const [period, setPeriod] = useState<TrendsPeriodPreset | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustomStart, setAppliedCustomStart] = useState("");
  const [appliedCustomEnd, setAppliedCustomEnd] = useState("");
  const [dashboard, setDashboard] = useState<TrendsDashboard | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const loadDashboard = useCallback(async () => {
    if (period === "custom" && (!appliedCustomStart || !appliedCustomEnd)) {
      setValidationError(
        "Select a start and end date, then click Apply to load a custom range.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await fetchTrendsDashboard({
        period: period ?? undefined,
        customStart: period === "custom" ? appliedCustomStart : undefined,
        customEnd: period === "custom" ? appliedCustomEnd : undefined,
      });

      setConfigured(payload.configured);
      setValidationError(payload.validationError);
      setDashboard(payload.dashboard);

      if (!initializedRef.current) {
        if (payload.dashboard?.period.preset) {
          setPeriod(payload.dashboard.period.preset);
        } else if (payload.defaultPreset) {
          setPeriod(payload.defaultPreset);
        }
        initializedRef.current = true;
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load trends dashboard.",
      );
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [appliedCustomEnd, appliedCustomStart, period]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useImportsRefreshed(loadDashboard);

  const activeLabel = dashboard?.period.label ?? null;
  const comparisonLabel = dashboard?.period.comparisonLabel ?? null;

  const handlePeriodChange = (nextPeriod: TrendsPeriodPreset) => {
    setPeriod(nextPeriod);
    setValidationError(null);
  };

  const handleApplyCustom = () => {
    setAppliedCustomStart(customStart);
    setAppliedCustomEnd(customEnd);
    setValidationError(null);
  };

  const handleClearCustom = () => {
    setCustomStart("");
    setCustomEnd("");
    setAppliedCustomStart("");
    setAppliedCustomEnd("");
    setValidationError(null);
  };

  const groupingLabel = useMemo(() => {
    switch (dashboard?.incidentTrend.grouping) {
      case "hour":
        return "hourly";
      case "day":
        return "daily";
      case "week":
        return "weekly";
      case "month":
        return "monthly";
      default:
        return "period";
    }
  }, [dashboard?.incidentTrend.grouping]);

  if (!configured) {
    return (
      <SectionPageShell
        eyebrow="Trends"
        title="Compliance Trends"
        description="Track held-open exit event trends, exception patterns and improving or declining fire exit performance over time."
      >
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">
            Supabase is not configured. Connect your database to load trend analytics.
          </p>
        </section>
      </SectionPageShell>
    );
  }

  if (loading && !dashboard) {
    return (
      <SectionPageShell
        eyebrow="Trends"
        title="Compliance Trends"
        description="Track held-open exit event trends, exception patterns and improving or declining fire exit performance over time."
      >
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">Loading trend analytics…</p>
        </section>
      </SectionPageShell>
    );
  }

  if (error && !dashboard) {
    return (
      <SectionPageShell
        eyebrow="Trends"
        title="Compliance Trends"
        description="Track held-open exit event trends, exception patterns and improving or declining fire exit performance over time."
      >
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Retry
          </button>
        </section>
      </SectionPageShell>
    );
  }

  if (!dashboard?.hasProcessedImports) {
    return (
      <SectionPageShell
        eyebrow="Trends"
        title="Compliance Trends"
        description="Track held-open exit event trends, exception patterns and improving or declining fire exit performance over time."
      >
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">
            No processed imports yet.{" "}
            <Link href="/imports/upload" className="text-cyan-400 hover:underline">
              Upload import data
            </Link>{" "}
            to unlock trend analysis.
          </p>
        </section>
      </SectionPageShell>
    );
  }

  return (
    <SectionPageShell
      eyebrow="Trends"
      title="Compliance Trends"
      description="Track held-open exit event trends, exception patterns and improving or declining fire exit performance over time."
    >
      <TrendsPeriodSelector
        period={period ?? dashboard.period.preset}
        customStart={customStart}
        customEnd={customEnd}
        activeLabel={activeLabel}
        comparisonLabel={comparisonLabel}
        validationError={validationError}
        onPeriodChange={handlePeriodChange}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onApplyCustom={handleApplyCustom}
        onClearCustom={handleClearCustom}
      />

      {!dashboard.hasIncidentsInPeriod ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <p className="text-sm text-slate-400">
            No compliance incidents were recorded in the selected reporting period.
          </p>
        </section>
      ) : null}

      <SectionCard
        title="Compliance trend"
        description="Portfolio compliance score for the selected period compared with the previous comparable period."
      >
        <ComparisonNote available={dashboard.complianceTrend.comparisonAvailable} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Current"
            value={`${dashboard.complianceTrend.currentScore}%`}
          />
          <MetricCard
            label="Previous period"
            value={
              dashboard.complianceTrend.previousScore !== null
                ? `${dashboard.complianceTrend.previousScore}%`
                : "N/A"
            }
          />
          <MetricCard
            label="Change"
            value={formatSignedPoints(dashboard.complianceTrend.differencePoints)}
          />
          <MetricCard
            label="Status"
            value={dashboard.complianceTrend.status}
            detail={
              dashboard.complianceTrend.status === "Improving"
                ? "Compliance is improving"
                : dashboard.complianceTrend.status === "Deteriorating"
                  ? "Compliance is declining"
                  : undefined
            }
          />
        </div>
        <div className="mt-6">
          <SimpleTrendChart
            title="Compliance score over time"
            points={dashboard.complianceTrend.chartPoints.map((point) => ({
              label: point.label,
              value: point.complianceScore,
            }))}
            valueSuffix="%"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Incident trend"
        description={`Compliance incidents grouped ${groupingLabel} for the selected period.`}
      >
        <ComparisonNote available={dashboard.incidentTrend.comparisonAvailable} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Total compliance incidents"
            value={String(dashboard.incidentTrend.totalIncidents)}
          />
          <MetricCard
            label="Previous period"
            value={
              dashboard.incidentTrend.previousTotalIncidents !== null
                ? String(dashboard.incidentTrend.previousTotalIncidents)
                : "N/A"
            }
          />
          <MetricCard
            label="Change"
            value={formatSignedCount(dashboard.incidentTrend.change)}
          />
          <MetricCard
            label="Average incidents per day"
            value={
              dashboard.incidentTrend.averagePerDay !== null
                ? String(dashboard.incidentTrend.averagePerDay)
                : "N/A"
            }
          />
          <MetricCard
            label="Highest incident day"
            value={
              dashboard.incidentTrend.highestDay
                ? `${dashboard.incidentTrend.highestDay.count}`
                : "N/A"
            }
            detail={dashboard.incidentTrend.highestDay?.label}
          />
          <MetricCard
            label="Lowest incident day"
            value={
              dashboard.incidentTrend.lowestDay
                ? `${dashboard.incidentTrend.lowestDay.count}`
                : "N/A"
            }
            detail={dashboard.incidentTrend.lowestDay?.label}
          />
        </div>
        <div className="mt-6">
          <IncidentTrendChart
            title="Incidents over time"
            points={dashboard.incidentTrend.chartPoints}
            mode="incidents"
          />
        </div>
      </SectionCard>

      <SectionCard
        title={`${TIME_BEYOND_THRESHOLD_LABEL} trend`}
        description={`Total ${TIME_BEYOND_THRESHOLD_LABEL.toLowerCase()} for the selected period.`}
      >
        <ComparisonNote
          available={dashboard.timeBeyondThresholdTrend.comparisonAvailable}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={`Total ${TIME_BEYOND_THRESHOLD_LABEL}`}
            value={dashboard.timeBeyondThresholdTrend.totalLabel}
          />
          <MetricCard
            label="Previous period"
            value={
              dashboard.timeBeyondThresholdTrend.previousTotalLabel ?? "N/A"
            }
          />
          <MetricCard
            label="Difference"
            value={dashboard.timeBeyondThresholdTrend.differenceLabel ?? "N/A"}
          />
          <MetricCard
            label="Average per day"
            value={dashboard.timeBeyondThresholdTrend.averagePerDayLabel ?? "N/A"}
          />
          <MetricCard
            label="Longest single incident"
            value={
              dashboard.timeBeyondThresholdTrend.longestSingleIncidentLabel ??
              "N/A"
            }
            detail={dashboard.timeBeyondThresholdTrend.longestSingleIncidentDoor ?? undefined}
          />
          <MetricCard
            label="Highest exposure day"
            value={
              dashboard.timeBeyondThresholdTrend.highestExposureDay
                ? dashboard.timeBeyondThresholdTrend.highestExposureDay.labelFormatted
                : "N/A"
            }
            detail={dashboard.timeBeyondThresholdTrend.highestExposureDay?.label}
          />
        </div>
        <div className="mt-6">
          <IncidentTrendChart
            title={`${TIME_BEYOND_THRESHOLD_LABEL} over time`}
            points={dashboard.timeBeyondThresholdTrend.chartPoints}
            mode="exposure"
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Top improving doors"
          description="Doors with the largest compliance score improvement versus the previous period."
        >
          {!dashboard.improvingComparisonAvailable ? (
            <p className="text-sm text-slate-500">
              Not enough historical data to calculate improvement.
            </p>
          ) : dashboard.topImprovingDoors.length === 0 ? (
            <p className="text-sm text-slate-500">
              No improving doors identified for this comparison.
            </p>
          ) : (
            <DoorComparisonTable rows={dashboard.topImprovingDoors} />
          )}
        </SectionCard>

        <SectionCard
          title="Top declining doors"
          description="Doors with the largest compliance deterioration versus the previous period."
        >
          {!dashboard.improvingComparisonAvailable ? (
            <p className="text-sm text-slate-500">
              Not enough historical data to calculate deterioration.
            </p>
          ) : dashboard.topDecliningDoors.length === 0 ? (
            <p className="text-sm text-slate-500">
              No declining doors identified for this comparison.
            </p>
          ) : (
            <DoorComparisonTable rows={dashboard.topDecliningDoors} showRisk />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recurring problem doors"
        description="Doors with repeated compliance incidents in the selected period, ranked by risk."
      >
        {dashboard.recurringProblemDoors.length === 0 ? (
          <p className="text-sm text-slate-500">
            No recurring problem doors in the selected period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Door</th>
                  <th className="px-3 py-2">Incidents</th>
                  <th className="px-3 py-2">{TIME_BEYOND_THRESHOLD_LABEL}</th>
                  <th className="px-3 py-2">Longest incident</th>
                  <th className="px-3 py-2">Most common hour</th>
                  <th className="px-3 py-2">Most common day</th>
                  <th className="px-3 py-2">Days affected</th>
                  <th className="px-3 py-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recurringProblemDoors.map((row) => (
                  <tr key={row.door} className="border-t border-slate-800">
                    <td className="px-3 py-3">
                      <DoorLink door={row.door} />
                    </td>
                    <td className="px-3 py-3 text-slate-300">{row.incidentCount}</td>
                    <td className="px-3 py-3 text-slate-300">
                      {row.timeBeyondThresholdLabel}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {row.longestIncidentLabel}
                    </td>
                    <td className="px-3 py-3 text-slate-300">{row.mostCommonHour}</td>
                    <td className="px-3 py-3 text-slate-300">{row.mostCommonDay}</td>
                    <td className="px-3 py-3 text-slate-300">{row.daysAffected}</td>
                    <td className={`px-3 py-3 font-semibold ${RISK_STYLES[row.riskLevel]}`}>
                      {row.riskLevel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {dashboard.operationalPatterns ? (
        <SectionCard
          title="Operational patterns"
          description="Summary of incident timing and door concentration for the selected period."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Busiest incident period"
              value={dashboard.operationalPatterns.busiestPeriod}
            />
            <MetricCard
              label="Quietest period"
              value={dashboard.operationalPatterns.quietestPeriod}
            />
            <MetricCard
              label="Highest-risk day"
              value={dashboard.operationalPatterns.highestRiskDay}
            />
            <MetricCard
              label="Most common incident hour"
              value={dashboard.operationalPatterns.mostCommonIncidentHour}
            />
            <MetricCard
              label="Most common duration band"
              value={dashboard.operationalPatterns.mostCommonDurationBand}
            />
            <MetricCard
              label="Most frequently affected door"
              value={dashboard.operationalPatterns.mostFrequentlyAffectedDoor}
            />
            <MetricCard
              label="Top three doors share"
              value={`${dashboard.operationalPatterns.topThreeDoorsIncidentSharePercent}%`}
              detail="Percentage of incidents caused by the top three doors"
            />
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Executive insights"
        description="Up to five factual management insights derived from the selected reporting period."
      >
        {dashboard.executiveInsights.length === 0 ? (
          <p className="text-sm text-slate-500">
            No executive insights available for this period.
          </p>
        ) : (
          <ul className="space-y-3">
            {dashboard.executiveInsights.map((insight) => (
              <li
                key={insight}
                className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
              >
                {insight}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </SectionPageShell>
  );
}

function DoorComparisonTable({
  rows,
  showRisk = false,
}: {
  rows: TrendsDashboard["topImprovingDoors"];
  showRisk?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Door</th>
            <th className="px-3 py-2">Previous score</th>
            <th className="px-3 py-2">Current score</th>
            <th className="px-3 py-2">Difference</th>
            <th className="px-3 py-2">Previous incidents</th>
            <th className="px-3 py-2">Current incidents</th>
            <th className="px-3 py-2">Trend</th>
            {showRisk ? <th className="px-3 py-2">Risk</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.door} className="border-t border-slate-800">
              <td className="px-3 py-3">
                <DoorLink door={row.door} />
              </td>
              <td className="px-3 py-3 text-slate-300">
                {row.previousComplianceScore !== null
                  ? `${row.previousComplianceScore}%`
                  : "N/A"}
              </td>
              <td className="px-3 py-3 text-slate-300">
                {row.currentComplianceScore}%
              </td>
              <td className="px-3 py-3 text-slate-300">
                {row.differencePoints !== null
                  ? formatSignedPoints(row.differencePoints)
                  : "N/A"}
              </td>
              <td className="px-3 py-3 text-slate-300">
                {row.previousIncidentCount ?? "N/A"}
              </td>
              <td className="px-3 py-3 text-slate-300">{row.currentIncidentCount}</td>
              <td className={`px-3 py-3 font-semibold ${TREND_STYLES[row.trend]}`}>
                {row.trend}
              </td>
              {showRisk ? (
                <td className={`px-3 py-3 font-semibold ${RISK_STYLES[row.riskLevel]}`}>
                  {row.riskLevel}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
