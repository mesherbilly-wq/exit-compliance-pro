import type { FieldMapping } from "@/lib/imports/types";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import {
  buildDayOfWeekDistribution,
  buildDailyTrend,
  buildHourlyTrend,
  buildMonthlyTrend,
  buildTimeOfDayDistribution,
  buildWeeklyTrend,
  countDaysAffected,
} from "./distributions";
import {
  generateComplianceRecommendations,
  formatRecommendationMessage,
} from "./compliance-recommendations";
import {
  getRiskRating,
  type RiskRating,
  type TrendDirection,
} from "./door-intelligence-view";
import { runFireExitIntelligenceFromParsedEvents } from "./fire-exit-intelligence-engine";
import { getDoorIncidents, normalizeIntelligenceReport } from "./normalize-intelligence";
import {
  filterEventsByTimestamp,
  type TrendsGrouping,
  type TrendsPeriodBounds,
  type TrendsPeriodPreset,
} from "./trends-period";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  FireExitIntelligenceReport,
  ParsedFireExitEvent,
  TrendPoint,
} from "./types";

export type TrendsImportMetadata = {
  headers: string[];
  mapping: FieldMapping;
  hasDurationField: boolean;
  analyzedRowCount: number;
  sourceFileName: string;
};

export type ComplianceTrendSection = {
  currentScore: number;
  previousScore: number | null;
  differencePoints: number | null;
  status: TrendDirection;
  comparisonAvailable: boolean;
  chartPoints: Array<{
    periodKey: string;
    label: string;
    complianceScore: number;
  }>;
};

export type IncidentTrendSection = {
  totalIncidents: number;
  previousTotalIncidents: number | null;
  change: number | null;
  averagePerDay: number | null;
  highestDay: { label: string; count: number } | null;
  lowestDay: { label: string; count: number } | null;
  comparisonAvailable: boolean;
  chartPoints: TrendPoint[];
  grouping: TrendsGrouping;
};

export type TimeBeyondThresholdTrendSection = {
  totalSeconds: number;
  totalLabel: string;
  previousTotalSeconds: number | null;
  previousTotalLabel: string | null;
  differenceSeconds: number | null;
  differenceLabel: string | null;
  averagePerDayLabel: string | null;
  longestSingleIncidentLabel: string | null;
  longestSingleIncidentDoor: string | null;
  highestExposureDay: { label: string; seconds: number; labelFormatted: string } | null;
  comparisonAvailable: boolean;
  chartPoints: TrendPoint[];
  grouping: TrendsGrouping;
};

export type DoorPeriodComparisonRow = {
  door: string;
  previousComplianceScore: number | null;
  currentComplianceScore: number;
  differencePoints: number | null;
  previousIncidentCount: number | null;
  currentIncidentCount: number;
  trend: TrendDirection;
  riskLevel: RiskRating;
};

export type RecurringProblemDoorRow = {
  door: string;
  incidentCount: number;
  timeBeyondThresholdLabel: string;
  timeBeyondThresholdSeconds: number;
  longestIncidentLabel: string;
  mostCommonHour: string;
  mostCommonDay: string;
  daysAffected: number;
  riskLevel: RiskRating;
};

export type OperationalPatternsSection = {
  busiestPeriod: string;
  quietestPeriod: string;
  highestRiskDay: string;
  mostCommonIncidentHour: string;
  mostCommonDurationBand: string;
  mostFrequentlyAffectedDoor: string;
  topThreeDoorsIncidentSharePercent: number;
};

export type TrendsDashboard = {
  period: TrendsPeriodBounds;
  hasProcessedImports: boolean;
  hasIncidentsInPeriod: boolean;
  complianceTrend: ComplianceTrendSection;
  incidentTrend: IncidentTrendSection;
  timeBeyondThresholdTrend: TimeBeyondThresholdTrendSection;
  topImprovingDoors: DoorPeriodComparisonRow[];
  topDecliningDoors: DoorPeriodComparisonRow[];
  recurringProblemDoors: RecurringProblemDoorRow[];
  operationalPatterns: OperationalPatternsSection | null;
  executiveInsights: string[];
  improvingComparisonAvailable: boolean;
};

export type BuildTrendsDashboardInput = {
  allEvents: ParsedFireExitEvent[];
  eventsByImportId: Map<string, ParsedFireExitEvent[]>;
  metadata: TrendsImportMetadata;
  config: FireExitAnalyticsConfig;
  bounds: TrendsPeriodBounds;
};

const OPERATIONAL_WINDOWS = [
  { label: "Early morning (00:00–05:59)", startHour: 0, endHour: 5 },
  { label: "Morning (06:00–09:59)", startHour: 6, endHour: 9 },
  { label: "Midday (10:00–13:59)", startHour: 10, endHour: 13 },
  { label: "Afternoon (14:00–17:59)", startHour: 14, endHour: 17 },
  { label: "Evening (18:00–21:59)", startHour: 18, endHour: 21 },
  { label: "Late night (22:00–23:59)", startHour: 22, endHour: 23 },
] as const;

export function buildTrendsDashboard(
  input: BuildTrendsDashboardInput,
): TrendsDashboard {
  const { bounds, config, metadata } = input;
  const currentEvents = selectPeriodEvents(input);
  const previousEvents = selectPreviousPeriodEvents(input);

  const currentReport = buildReportFromEvents(currentEvents, metadata, config);
  const previousReport =
    previousEvents.length > 0
      ? buildReportFromEvents(previousEvents, metadata, config)
      : null;

  const currentIncidents = collectIncidents(currentReport);
  const previousIncidents = previousReport
    ? collectIncidents(previousReport)
    : [];

  const hasIncidentsInPeriod = currentIncidents.length > 0;
  const doorComparisons = buildDoorComparisons(currentReport, previousReport, bounds);
  const improvingComparisonAvailable =
    bounds.comparisonAvailable && doorComparisons.some((row) => row.differencePoints !== null);

  return {
    period: bounds,
    hasProcessedImports: input.allEvents.length > 0,
    hasIncidentsInPeriod,
    complianceTrend: buildComplianceTrendSection(
      currentReport,
      previousReport,
      currentEvents,
      metadata,
      config,
      bounds,
    ),
    incidentTrend: buildIncidentTrendSection(
      currentIncidents,
      previousIncidents,
      bounds,
    ),
    timeBeyondThresholdTrend: buildTimeBeyondThresholdTrendSection(
      currentIncidents,
      previousIncidents,
      bounds,
    ),
    topImprovingDoors: rankImprovingDoors(doorComparisons),
    topDecliningDoors: rankDecliningDoors(doorComparisons),
    recurringProblemDoors: buildRecurringProblemDoors(currentReport),
    operationalPatterns: hasIncidentsInPeriod
      ? buildOperationalPatterns(currentIncidents)
      : null,
    executiveInsights: buildExecutiveInsights({
      bounds,
      currentReport,
      previousReport,
      currentIncidents,
      doorComparisons,
      operationalPatterns: hasIncidentsInPeriod
        ? buildOperationalPatterns(currentIncidents)
        : null,
    }),
    improvingComparisonAvailable,
  };
}

function selectPeriodEvents(input: BuildTrendsDashboardInput): ParsedFireExitEvent[] {
  const { bounds, eventsByImportId, allEvents } = input;

  if (bounds.preset === "last-import" && bounds.importId) {
    return eventsByImportId.get(bounds.importId) ?? [];
  }

  return filterEventsByTimestamp(allEvents, bounds.startMs, bounds.endMs);
}

function selectPreviousPeriodEvents(
  input: BuildTrendsDashboardInput,
): ParsedFireExitEvent[] {
  const { bounds, eventsByImportId, allEvents } = input;

  if (!bounds.comparisonAvailable) {
    return [];
  }

  if (bounds.preset === "last-import" && bounds.previousImportId) {
    return eventsByImportId.get(bounds.previousImportId) ?? [];
  }

  if (
    bounds.comparisonStartMs === null ||
    bounds.comparisonEndMs === null
  ) {
    return [];
  }

  return filterEventsByTimestamp(
    allEvents,
    bounds.comparisonStartMs,
    bounds.comparisonEndMs,
  );
}

function buildReportFromEvents(
  events: ParsedFireExitEvent[],
  metadata: TrendsImportMetadata,
  config: FireExitAnalyticsConfig,
): FireExitIntelligenceReport {
  if (events.length === 0) {
    return normalizeIntelligenceReport(
      runFireExitIntelligenceFromParsedEvents([], metadata.headers, [], {
        sourceFileName: metadata.sourceFileName,
        config,
        analyzedRowCount: 0,
        hasDurationField: metadata.hasDurationField,
        mapping: metadata.mapping,
      }).report,
    );
  }

  return normalizeIntelligenceReport(
    runFireExitIntelligenceFromParsedEvents(
      events,
      metadata.headers,
      [],
      {
        sourceFileName: metadata.sourceFileName,
        config,
        analyzedRowCount: events.length,
        hasDurationField: metadata.hasDurationField,
        mapping: metadata.mapping,
      },
    ).report,
  );
}

function collectIncidents(report: FireExitIntelligenceReport): ComplianceIncident[] {
  return report.doors.flatMap((door) => getDoorIncidents(door, report.config.heldOpenThresholdSeconds));
}

function buildComplianceTrendSection(
  currentReport: FireExitIntelligenceReport,
  previousReport: FireExitIntelligenceReport | null,
  currentEvents: ParsedFireExitEvent[],
  metadata: TrendsImportMetadata,
  config: FireExitAnalyticsConfig,
  bounds: TrendsPeriodBounds,
): ComplianceTrendSection {
  const currentScore = currentReport.summary.overallComplianceScore;
  const previousScore = previousReport?.summary.overallComplianceScore ?? null;
  const differencePoints =
    previousScore !== null ? currentScore - previousScore : null;

  return {
    currentScore,
    previousScore,
    differencePoints,
    status: scoreTrendDirection(differencePoints),
    comparisonAvailable: bounds.comparisonAvailable && previousScore !== null,
    chartPoints: buildComplianceScoreSeries(
      currentEvents,
      metadata,
      config,
      bounds,
    ),
  };
}

function buildComplianceScoreSeries(
  events: ParsedFireExitEvent[],
  metadata: TrendsImportMetadata,
  config: FireExitAnalyticsConfig,
  bounds: TrendsPeriodBounds,
): ComplianceTrendSection["chartPoints"] {
  if (events.length === 0) {
    return [];
  }

  const incidents = collectIncidents(buildReportFromEvents(events, metadata, config));
  const grouped = groupIncidents(incidents, bounds.grouping);

  return grouped.map((bucket) => {
    const bucketEvents = filterEventsByTimestamp(
      events,
      bucket.startMs,
      bucket.endMs,
    );
    const report = buildReportFromEvents(bucketEvents, metadata, config);

    return {
      periodKey: bucket.periodKey,
      label: bucket.label,
      complianceScore: report.summary.overallComplianceScore,
    };
  });
}

function buildIncidentTrendSection(
  currentIncidents: ComplianceIncident[],
  previousIncidents: ComplianceIncident[],
  bounds: TrendsPeriodBounds,
): IncidentTrendSection {
  const chartPoints = buildGroupedTrendPoints(currentIncidents, bounds.grouping);
  const periodDays = Math.max(
    1,
    Math.ceil((bounds.endMs - bounds.startMs + 1) / (24 * 60 * 60 * 1000)),
  );

  const dayBuckets = buildDailyTrend(currentIncidents);
  const highestDay = findHighestBucket(dayBuckets, "heldOpenEvents");
  const lowestDay = findLowestBucket(dayBuckets, "heldOpenEvents");

  return {
    totalIncidents: currentIncidents.length,
    previousTotalIncidents: bounds.comparisonAvailable
      ? previousIncidents.length
      : null,
    change: bounds.comparisonAvailable
      ? currentIncidents.length - previousIncidents.length
      : null,
    averagePerDay:
      currentIncidents.length > 0
        ? Number((currentIncidents.length / periodDays).toFixed(1))
        : null,
    highestDay: highestDay
      ? { label: highestDay.label, count: highestDay.heldOpenEvents }
      : null,
    lowestDay:
      dayBuckets.length > 0 && lowestDay
        ? { label: lowestDay.label, count: lowestDay.heldOpenEvents }
        : null,
    comparisonAvailable: bounds.comparisonAvailable,
    chartPoints,
    grouping: bounds.grouping,
  };
}

function buildTimeBeyondThresholdTrendSection(
  currentIncidents: ComplianceIncident[],
  previousIncidents: ComplianceIncident[],
  bounds: TrendsPeriodBounds,
): TimeBeyondThresholdTrendSection {
  const totalSeconds = sumExposure(currentIncidents);
  const previousTotalSeconds = bounds.comparisonAvailable
    ? sumExposure(previousIncidents)
    : null;
  const differenceSeconds =
    previousTotalSeconds !== null ? totalSeconds - previousTotalSeconds : null;

  const periodDays = Math.max(
    1,
    Math.ceil((bounds.endMs - bounds.startMs + 1) / (24 * 60 * 60 * 1000)),
  );

  const longest = [...currentIncidents].sort(
    (a, b) => b.timeBeyondThresholdSeconds - a.timeBeyondThresholdSeconds,
  )[0];

  const dayBuckets = buildDailyTrend(currentIncidents);
  const highestExposureDay = findHighestBucket(dayBuckets, "exposureSeconds");

  return {
    totalSeconds,
    totalLabel: formatDurationLabel(totalSeconds),
    previousTotalSeconds,
    previousTotalLabel:
      previousTotalSeconds !== null
        ? formatDurationLabel(previousTotalSeconds)
        : null,
    differenceSeconds,
    differenceLabel:
      differenceSeconds !== null
        ? formatSignedDurationLabel(differenceSeconds)
        : null,
    averagePerDayLabel:
      totalSeconds > 0
        ? formatDurationLabel(Math.round(totalSeconds / periodDays))
        : null,
    longestSingleIncidentLabel: longest
      ? formatDurationLabel(longest.timeBeyondThresholdSeconds)
      : null,
    longestSingleIncidentDoor: longest?.door ?? null,
    highestExposureDay: highestExposureDay
      ? {
          label: highestExposureDay.label,
          seconds: highestExposureDay.exposureSeconds,
          labelFormatted: formatDurationLabel(highestExposureDay.exposureSeconds),
        }
      : null,
    comparisonAvailable: bounds.comparisonAvailable,
    chartPoints: buildGroupedTrendPoints(currentIncidents, bounds.grouping),
    grouping: bounds.grouping,
  };
}

function buildDoorComparisons(
  currentReport: FireExitIntelligenceReport,
  previousReport: FireExitIntelligenceReport | null,
  bounds: TrendsPeriodBounds,
): DoorPeriodComparisonRow[] {
  const doorNames = new Set<string>([
    ...currentReport.doors.map((door) => door.door),
    ...(previousReport?.doors.map((door) => door.door) ?? []),
  ]);

  return [...doorNames].map((door) => {
    const currentDoor = currentReport.doors.find((item) => item.door === door);
    const previousDoor = previousReport?.doors.find((item) => item.door === door);
    const currentScore = currentDoor?.complianceScore ?? 100;
    const previousScore = previousDoor?.complianceScore ?? null;
    const currentIncidents =
      currentDoor?.totalIncidents ??
      (currentDoor ? getDoorIncidents(currentDoor, currentReport.config.heldOpenThresholdSeconds).length : 0);
    const previousIncidents = previousDoor?.totalIncidents ?? null;
    const differencePoints =
      bounds.comparisonAvailable && previousScore !== null
        ? currentScore - previousScore
        : null;

    const profile = currentDoor ?? previousDoor;

    return {
      door,
      previousComplianceScore: bounds.comparisonAvailable ? previousScore : null,
      currentComplianceScore: currentScore,
      differencePoints,
      previousIncidentCount: bounds.comparisonAvailable ? previousIncidents : null,
      currentIncidentCount: currentIncidents,
      trend: scoreTrendDirection(differencePoints),
      riskLevel: profile ? getRiskRating(profile) : "Low",
    };
  });
}

function rankImprovingDoors(rows: DoorPeriodComparisonRow[]): DoorPeriodComparisonRow[] {
  return rows
    .filter((row) => row.differencePoints !== null && row.differencePoints > 0)
    .sort((a, b) => (b.differencePoints ?? 0) - (a.differencePoints ?? 0))
    .slice(0, 10);
}

function rankDecliningDoors(rows: DoorPeriodComparisonRow[]): DoorPeriodComparisonRow[] {
  return rows
    .filter((row) => row.differencePoints !== null && row.differencePoints < 0)
    .sort((a, b) => (a.differencePoints ?? 0) - (b.differencePoints ?? 0))
    .slice(0, 10);
}

function buildRecurringProblemDoors(
  report: FireExitIntelligenceReport,
): RecurringProblemDoorRow[] {
  return report.doors
    .filter((door) => (door.totalIncidents ?? 0) > 0)
    .map((door) => {
      const incidents = getDoorIncidents(door, report.config.heldOpenThresholdSeconds);
      const timeDistribution = buildTimeOfDayDistribution(incidents);
      const dayDistribution = buildDayOfWeekDistribution(incidents);
      const longest = [...incidents].sort(
        (a, b) => b.timeBeyondThresholdSeconds - a.timeBeyondThresholdSeconds,
      )[0];

      return {
        door: door.door,
        incidentCount: door.totalIncidents ?? incidents.length,
        timeBeyondThresholdLabel: door.totalExposureLabel,
        timeBeyondThresholdSeconds: door.totalExposureSeconds,
        longestIncidentLabel: longest
          ? formatDurationLabel(longest.timeBeyondThresholdSeconds)
          : "N/A",
        mostCommonHour: topBucketLabel(timeDistribution),
        mostCommonDay: topBucketLabel(dayDistribution),
        daysAffected: door.daysAffected || countDaysAffected(incidents),
        riskLevel: getRiskRating(door),
      };
    })
    .sort((a, b) => {
      const riskDiff = riskOrder(b.riskLevel) - riskOrder(a.riskLevel);
      if (riskDiff !== 0) {
        return riskDiff;
      }

      if (b.incidentCount !== a.incidentCount) {
        return b.incidentCount - a.incidentCount;
      }

      return b.timeBeyondThresholdSeconds - a.timeBeyondThresholdSeconds;
    })
    .slice(0, 10);
}

function buildOperationalPatterns(
  incidents: ComplianceIncident[],
): OperationalPatternsSection {
  const timeDistribution = buildTimeOfDayDistribution(incidents);
  const dayDistribution = buildDayOfWeekDistribution(incidents);
  const windowCounts = OPERATIONAL_WINDOWS.map((window) => ({
    label: window.label,
    count: incidents.filter(
      (incident) =>
        incident.hourStarted >= window.startHour &&
        incident.hourStarted <= window.endHour,
    ).length,
  }));

  const busiest = [...windowCounts].sort((a, b) => b.count - a.count)[0];
  const quietest = [...windowCounts]
    .filter((window) => window.count >= 0)
    .sort((a, b) => a.count - b.count)[0];

  const durationBands = new Map<string, number>();
  for (const incident of incidents) {
    durationBands.set(
      incident.durationBucket,
      (durationBands.get(incident.durationBucket) ?? 0) + 1,
    );
  }

  const doorCounts = new Map<string, number>();
  for (const incident of incidents) {
    doorCounts.set(incident.door, (doorCounts.get(incident.door) ?? 0) + 1);
  }

  const sortedDoors = [...doorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topThreeCount = sortedDoors.slice(0, 3).reduce((sum, [, count]) => sum + count, 0);

  return {
    busiestPeriod: busiest?.count ? busiest.label : "N/A",
    quietestPeriod: quietest ? quietest.label : "N/A",
    highestRiskDay: topBucketLabel(dayDistribution),
    mostCommonIncidentHour: topBucketLabel(timeDistribution),
    mostCommonDurationBand: topDurationBand(durationBands),
    mostFrequentlyAffectedDoor: sortedDoors[0]?.[0] ?? "N/A",
    topThreeDoorsIncidentSharePercent:
      incidents.length > 0
        ? Math.round((topThreeCount / incidents.length) * 100)
        : 0,
  };
}

function buildExecutiveInsights(input: {
  bounds: TrendsPeriodBounds;
  currentReport: FireExitIntelligenceReport;
  previousReport: FireExitIntelligenceReport | null;
  currentIncidents: ComplianceIncident[];
  doorComparisons: DoorPeriodComparisonRow[];
  operationalPatterns: OperationalPatternsSection | null;
}): string[] {
  const insights: string[] = [];

  if (
    input.bounds.comparisonAvailable &&
    input.previousReport &&
    input.currentReport.summary.overallComplianceScore !==
      input.previousReport.summary.overallComplianceScore
  ) {
    const diff =
      input.currentReport.summary.overallComplianceScore -
      input.previousReport.summary.overallComplianceScore;
    const direction = diff > 0 ? "improved" : "declined";
    insights.push(
      `Compliance ${direction} by ${Math.abs(diff)} percentage point${Math.abs(diff) === 1 ? "" : "s"} compared with the previous period.`,
    );
  }

  if (input.operationalPatterns?.mostCommonIncidentHour) {
    const hour = Number.parseInt(
      input.operationalPatterns.mostCommonIncidentHour.split(":")[0] ?? "0",
      10,
    );
    const nextHour = String((hour + 1) % 24).padStart(2, "0");
    insights.push(
      `Most incidents occurred between ${input.operationalPatterns.mostCommonIncidentHour} and ${nextHour}:00.`,
    );
  }

  const topDoor = [...input.currentReport.doors]
    .filter((door) => door.totalExposureSeconds > 0)
    .sort((a, b) => b.totalExposureSeconds - a.totalExposureSeconds)[0];

  const totalExposure = sumExposure(input.currentIncidents);
  if (topDoor && totalExposure > 0) {
    const share = Math.round((topDoor.totalExposureSeconds / totalExposure) * 100);
    insights.push(
      `${topDoor.door} accounted for ${share}% of all Time Beyond Threshold.`,
    );
  }

  if (input.operationalPatterns && input.currentIncidents.length > 0) {
    insights.push(
      `Three doors were responsible for ${input.operationalPatterns.topThreeDoorsIncidentSharePercent}% of all incidents.`,
    );
  }

  const topDeclining = rankDecliningDoors(input.doorComparisons)[0];
  if (topDeclining && topDeclining.differencePoints !== null) {
    insights.push(
      `${topDeclining.door} has deteriorated by ${Math.abs(topDeclining.differencePoints)} percentage points compared with the previous period.`,
    );
  }

  const recommendations = generateComplianceRecommendations(input.currentReport, 8)
    .map(formatRecommendationMessage)
    .filter((message) => message.trim().length > 0);

  for (const message of recommendations) {
    if (insights.length >= 5) {
      break;
    }

    if (!insights.includes(message)) {
      insights.push(message);
    }
  }

  return insights.slice(0, 5);
}

function buildGroupedTrendPoints(
  incidents: ComplianceIncident[],
  grouping: TrendsGrouping,
): TrendPoint[] {
  switch (grouping) {
    case "hour":
      return buildHourlyTrend(incidents);
    case "day":
      return buildDailyTrend(incidents);
    case "week":
      return buildWeeklyTrend(incidents);
    case "month":
      return buildMonthlyTrend(incidents);
    default:
      return buildDailyTrend(incidents);
  }
}

type IncidentBucket = {
  periodKey: string;
  label: string;
  startMs: number;
  endMs: number;
};

function groupIncidents(
  incidents: ComplianceIncident[],
  grouping: TrendsGrouping,
): IncidentBucket[] {
  const points = buildGroupedTrendPoints(incidents, grouping);
  const buckets = new Map<string, IncidentBucket>();

  for (const incident of incidents) {
    const key = periodKeyForIncident(incident, grouping);
    if (!buckets.has(key)) {
      buckets.set(key, {
        periodKey: key,
        label: points.find((point) => point.periodKey === key)?.label ?? key,
        startMs: incident.startTimestamp,
        endMs: incident.startTimestamp,
      });
    }

    const bucket = buckets.get(key)!;
    bucket.startMs = Math.min(bucket.startMs, incident.startTimestamp);
    bucket.endMs = Math.max(bucket.endMs, incident.startTimestamp);
  }

  return [...buckets.values()].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey),
  );
}

function periodKeyForIncident(
  incident: ComplianceIncident,
  grouping: TrendsGrouping,
): string {
  const date = new Date(incident.startTimestamp);

  if (grouping === "hour") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}`;
  }

  if (grouping === "day") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  if (grouping === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function scoreTrendDirection(differencePoints: number | null): TrendDirection {
  if (differencePoints === null) {
    return "N/A";
  }

  if (differencePoints >= 3) {
    return "Improving";
  }

  if (differencePoints <= -3) {
    return "Deteriorating";
  }

  return "Stable";
}

function sumExposure(incidents: ComplianceIncident[]): number {
  return incidents.reduce(
    (sum, incident) => sum + incident.timeBeyondThresholdSeconds,
    0,
  );
}

function findHighestBucket(
  points: TrendPoint[],
  key: "heldOpenEvents" | "exposureSeconds",
): TrendPoint | null {
  if (points.length === 0) {
    return null;
  }

  return [...points].sort((a, b) => b[key] - a[key])[0] ?? null;
}

function findLowestBucket(
  points: TrendPoint[],
  key: "heldOpenEvents" | "exposureSeconds",
): TrendPoint | null {
  if (points.length === 0) {
    return null;
  }

  return [...points].sort((a, b) => a[key] - b[key])[0] ?? null;
}

function topBucketLabel(
  buckets: Array<{ label: string; count: number }>,
): string {
  const top = [...buckets].sort((a, b) => b.count - a.count)[0];
  return top?.count ? top.label : "N/A";
}

function topDurationBand(bands: Map<string, number>): string {
  const top = [...bands.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[1] ? top[0] : "N/A";
}

function riskOrder(risk: RiskRating): number {
  return { Low: 1, Medium: 2, High: 3, Critical: 4 }[risk];
}

function formatSignedDurationLabel(seconds: number): string {
  const prefix = seconds > 0 ? "+" : seconds < 0 ? "−" : "";
  return `${prefix}${formatDurationLabel(Math.abs(seconds))}`;
}

export function parseTrendsPeriodPreset(
  value: string | null,
): TrendsPeriodPreset {
  switch (value) {
    case "last-import":
    case "last-24-hours":
    case "last-7-days":
    case "last-30-days":
    case "all-time":
    case "custom":
      return value;
    default:
      return "last-7-days";
  }
}
