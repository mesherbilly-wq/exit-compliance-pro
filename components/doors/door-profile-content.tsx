"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComplianceRecommendation } from "@/lib/analytics/compliance-recommendations";
import { loadDoorProfile } from "@/lib/analytics/door-profile-loader";
import type { RiskRating } from "@/lib/analytics/door-intelligence-view";
import {
  TIME_BEYOND_THRESHOLD_LABEL,
  TIME_BEYOND_THRESHOLD_TOOLTIP,
} from "@/lib/analytics/labels";
import type { ComplianceIncident, RiskTrend } from "@/lib/analytics/types";
import { decodeDoorParam } from "@/lib/doors/door-routes";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";
import { isPreviewOnlyAnalysis } from "@/lib/imports/types";
import {
  DistributionBars,
  TrendList,
} from "@/components/intelligence/distribution-bars";
import { PreviewDataBanner } from "@/components/ui/preview-data-banner";
import {
  formatDurationReadable,
  type DoorHealthStatus,
} from "@/lib/reports/held-open-detection";

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

const TREND_STYLES: Record<RiskTrend, string> = {
  Improving: "text-emerald-400",
  Stable: "text-slate-300",
  Worsening: "text-red-400",
  "N/A": "text-slate-500",
};

const PRIORITY_STYLES = {
  high: "border-red-500/30 bg-red-500/10 text-red-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  low: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
};

const INCIDENT_RISK_STYLES: Record<ComplianceIncident["riskRating"], string> = {
  Low: "text-emerald-400",
  Medium: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-red-400",
};

type DoorProfileContentProps = {
  doorParam: string;
};

export function DoorProfileContent({ doorParam }: DoorProfileContentProps) {
  const doorName = decodeDoorParam(doorParam);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(() => loadDoorProfile(doorName));

  const reloadProfile = useCallback(() => {
    setData(loadDoorProfile(doorName));
    setLoaded(true);
  }, [doorName]);

  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  useImportsRefreshed(reloadProfile);

  const timelineIncidents = useMemo(() => {
    if (!data.profile) {
      return [];
    }

    return [...data.profile.incidents].sort(
      (a, b) => b.startTimestamp - a.startTimestamp,
    );
  }, [data.profile]);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading door profile...</p>;
  }

  if (!data.importRecord) {
    return (
      <DoorProfileEmptyState
        title="No fire exit data imported yet"
        message="Upload a Genetec CSV to view door compliance profiles."
      />
    );
  }

  if (!data.profile) {
    return (
      <DoorProfileEmptyState
        title="Door not found"
        message={`No compliance profile was found for "${doorName}" in the latest import.`}
      >
        <Link
          href="/doors"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Back to Door Intelligence
        </Link>
      </DoorProfileEmptyState>
    );
  }

  const { profile, riskRating, thresholdSeconds, recommendations } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {isPreviewOnlyAnalysis(data.importRecord) && <PreviewDataBanner />}

      <div>
        <Link
          href="/doors"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Door Intelligence
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Fire Exit Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
          {profile.door}
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Door compliance profile derived from held-open exposure analytics for{" "}
          <span className="font-medium text-white">
            {data.report?.sourceFileName ?? data.importRecord.fileName}
          </span>
          .
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Compliance score" value={`${profile.complianceScore}%`} accent="text-cyan-400" />
        <SummaryCard
          label="Compliance rating"
          value={profile.complianceRating}
          accent="text-white"
          badgeClass={STATUS_STYLES[profile.complianceRating]}
        />
        <SummaryCard
          label="Current risk"
          value={riskRating ?? "N/A"}
          accent="text-white"
          badgeClass={riskRating ? RISK_STYLES[riskRating] : undefined}
        />
        <SummaryCard
          label="Held-open threshold"
          value={
            thresholdSeconds !== null
              ? formatDurationReadable(thresholdSeconds)
              : "N/A"
          }
          accent="text-white"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Compliance incidents"
          value={profile.incidentCount.toLocaleString()}
          accent="text-amber-400"
        />
        <SummaryCard
          label={TIME_BEYOND_THRESHOLD_LABEL}
          value={profile.timeBeyondThresholdLabel}
          accent="text-red-400"
          title={TIME_BEYOND_THRESHOLD_TOOLTIP}
        />
        <SummaryCard
          label="Longest incident"
          value={profile.longestIncidentLabel}
          accent="text-white"
        />
        <SummaryCard
          label="Average incident duration"
          value={profile.averageIncidentDurationLabel}
          accent="text-white"
        />
        <SummaryCard
          label="Last incident"
          value={profile.lastIncidentLabel}
          accent="text-white"
        />
        <SummaryCard
          label="Trend"
          value={profile.riskTrend}
          accent={TREND_STYLES[profile.riskTrend]}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Timeline</h3>
          <p className="mt-1 text-sm text-slate-400">
            Compliance incidents in reverse chronological order.
          </p>
        </div>

        {timelineIncidents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">
              No compliance incidents recorded for this fire exit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Beyond threshold</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Event type</th>
                </tr>
              </thead>
              <tbody>
                {timelineIncidents.map((incident, index) => (
                  <tr
                    key={`${incident.startTimestamp}-${index}`}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {incident.startTimeLabel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {incident.endTimeLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatDurationReadable(incident.durationSeconds)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatDurationReadable(incident.timeBeyondThresholdSeconds)}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${INCIDENT_RISK_STYLES[incident.riskRating]}`}
                    >
                      {incident.riskRating}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{incident.eventType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <TrendList title="Weekly activity" points={profile.weeklyTrend} />
        <TrendList title="Monthly activity" points={profile.monthlyTrend} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DistributionBars
          title="Time of day distribution"
          buckets={profile.timeOfDayDistribution}
        />
        <DistributionBars
          title="Day of week distribution"
          buckets={profile.dayOfWeekDistribution}
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-xl font-semibold">Operational pattern</h3>
        <p className="mt-1 text-sm text-slate-400">
          Detected behaviour based on incident timing and repeat activity.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PatternItem label="Pattern" value={profile.operationalPattern} />
          <PatternItem label="Incident frequency" value={profile.incidentFrequency} />
          <PatternItem label="Most common day" value={profile.mostCommonDay} />
          <PatternItem label="Most common time" value={profile.mostCommonTime} />
          <PatternItem label="Peak risk window" value={profile.peakRiskWindow} />
          <PatternItem label="Days affected" value={profile.daysAffected.toLocaleString()} />
        </dl>
      </section>

      <RecommendationsSection
        doorName={profile.door}
        recommendations={recommendations}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  title,
  badgeClass,
}: {
  label: string;
  value: string;
  accent: string;
  title?: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400" title={title}>
        {label}
      </p>
      {badgeClass ? (
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${badgeClass}`}
        >
          {value}
        </span>
      ) : (
        <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
      )}
    </div>
  );
}

function PatternItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}

function RecommendationsSection({
  doorName,
  recommendations,
}: {
  doorName: string;
  recommendations: ComplianceRecommendation[];
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-xl font-semibold">Recommendations</h3>
      <p className="mt-1 text-sm text-slate-400">
        Operational recommendations for {doorName} based on time patterns, trends,
        repeat behaviour and risk.
      </p>

      {recommendations.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No specific recommendations for this fire exit. Continue routine monitoring.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {recommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className={`rounded-xl border px-4 py-3 text-sm ${PRIORITY_STYLES[recommendation.priority]}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium capitalize">{recommendation.priority} priority</p>
                <span className="text-xs text-slate-400">
                  {recommendation.title}
                </span>
              </div>
              <p className="mt-2">{recommendation.summary}</p>
              <p className="mt-2 text-xs text-slate-400">{recommendation.action}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DoorProfileEmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/doors" className="text-sm text-cyan-400 hover:text-cyan-300">
        ← Back to Door Intelligence
      </Link>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-cyan-400">
        Fire Exit Intelligence
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">Door Profile</h2>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
