import { formatEventTimeLabel } from "@/lib/reports/door-event-analysis";
import {
  formatDurationLabel,
  getDoorHealthStatus,
} from "@/lib/reports/held-open-detection";
import {
  average,
  buildDayOfWeekDistribution,
  buildMonthlyTrend,
  buildTimeOfDayDistribution,
  buildWeeklyTrend,
  countDaysAffected,
  countRepeatOccurrences,
} from "./distributions";
import type {
  ComplianceIncident,
  ComplianceRating,
  DistributionBucket,
  DoorComplianceProfile,
  DoorIntelligenceProfile,
  FireExitIntelligenceReport,
  IncidentFrequency,
  OperationalPattern,
  RiskTrend,
  TrendPoint,
} from "./types";

const WEEKEND_DAYS = new Set(["Sat", "Sun"]);

export function calculateExposureComplianceScore(
  exposureSeconds: number,
  violationCount: number,
  repeatOccurrences: number,
  totalEvents: number,
): number {
  if (violationCount === 0) {
    return 100;
  }

  const exposureMinutes = exposureSeconds / 60;
  const violationRatio = violationCount / Math.max(totalEvents, 1);
  const score =
    100 -
    Math.min(35, exposureMinutes * 1.5) -
    Math.min(25, violationCount * 4) -
    Math.min(15, repeatOccurrences * 3) -
    violationRatio * 25;

  return Math.max(0, Math.round(score));
}

type TimeWindow = {
  label: OperationalPattern;
  startHour: number;
  endHour: number;
};

const OPERATIONAL_WINDOWS: TimeWindow[] = [
  { label: "Morning Deliveries", startHour: 6, endHour: 10 },
  { label: "Lunch Time", startHour: 11, endHour: 14 },
  { label: "Evenings", startHour: 17, endHour: 21 },
];

function getMostCommonBucket(buckets: DistributionBucket[]): string {
  const top = [...buckets]
    .filter((bucket) => bucket.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  return top?.label ?? "N/A";
}

function averageTrendMetric(points: TrendPoint[]): number {
  if (points.length === 0) {
    return 0;
  }

  return (
    points.reduce(
      (sum, point) => sum + point.exposureSeconds + point.heldOpenEvents * 10,
      0,
    ) / points.length
  );
}

export function getRiskTrend(weeklyTrend: TrendPoint[]): {
  riskTrend: RiskTrend;
  riskTrendScore: number;
} {
  if (weeklyTrend.length < 2) {
    return { riskTrend: "N/A", riskTrendScore: 0 };
  }

  const midpoint = Math.floor(weeklyTrend.length / 2);
  const earlier = weeklyTrend.slice(0, midpoint);
  const recent = weeklyTrend.slice(midpoint);
  const earlierAverage = averageTrendMetric(earlier);
  const recentAverage = averageTrendMetric(recent);

  if (earlierAverage === 0 && recentAverage === 0) {
    return { riskTrend: "Stable", riskTrendScore: 0 };
  }

  if (earlierAverage === 0 && recentAverage > 0) {
    return { riskTrend: "Worsening", riskTrendScore: recentAverage };
  }

  const changeRatio =
    (recentAverage - earlierAverage) / Math.max(earlierAverage, 1);
  const riskTrendScore = recentAverage - earlierAverage;

  if (changeRatio <= -0.2) {
    return { riskTrend: "Improving", riskTrendScore };
  }

  if (changeRatio >= 0.2) {
    return { riskTrend: "Worsening", riskTrendScore };
  }

  return { riskTrend: "Stable", riskTrendScore };
}

function getIncidentSpanDays(incidents: ComplianceIncident[]): number {
  if (incidents.length === 0) {
    return 0;
  }

  const sorted = [...incidents].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );
  const first = sorted[0]?.startTimestamp ?? 0;
  const last = sorted[sorted.length - 1]?.startTimestamp ?? first;
  const spanMs = Math.max(0, last - first);

  return Math.max(1, Math.ceil(spanMs / 86_400_000));
}

export function getIncidentFrequency(
  incidents: ComplianceIncident[],
): IncidentFrequency {
  const count = incidents.length;

  if (count === 0) {
    return "Rare";
  }

  if (count === 1) {
    return "Rare";
  }

  const spanDays = getIncidentSpanDays(incidents);
  const ratePerDay = count / spanDays;

  if (ratePerDay >= 0.7 || (count >= 5 && spanDays <= 7)) {
    return "Daily";
  }

  if (ratePerDay >= 0.13) {
    return "Weekly";
  }

  if (ratePerDay >= 0.03) {
    return "Monthly";
  }

  return "Rare";
}

function countIncidentsInHourRange(
  incidents: ComplianceIncident[],
  startHour: number,
  endHour: number,
): number {
  return incidents.filter(
    (incident) =>
      incident.hourStarted >= startHour && incident.hourStarted <= endHour,
  ).length;
}

function hasRecurringPattern(
  incidents: ComplianceIncident[],
  repeatOccurrences: number,
  dayOfWeekDistribution: DistributionBucket[],
  timeOfDayDistribution: DistributionBucket[],
): boolean {
  if (repeatOccurrences < 2 || incidents.length < 2) {
    return false;
  }

  const topDay = [...dayOfWeekDistribution].sort((a, b) => b.count - a.count)[0];
  const topHour = [...timeOfDayDistribution].sort((a, b) => b.count - a.count)[0];
  const dayConcentration = (topDay?.count ?? 0) / incidents.length;
  const hourConcentration = (topHour?.count ?? 0) / incidents.length;

  return dayConcentration >= 0.5 || hourConcentration >= 0.5;
}

export function getOperationalPattern(
  incidents: ComplianceIncident[],
  dayOfWeekDistribution: DistributionBucket[],
  timeOfDayDistribution: DistributionBucket[],
  repeatOccurrences: number,
): OperationalPattern {
  if (incidents.length === 0) {
    return "Random";
  }

  if (
    hasRecurringPattern(
      incidents,
      repeatOccurrences,
      dayOfWeekDistribution,
      timeOfDayDistribution,
    )
  ) {
    return "Recurring";
  }

  const weekendIncidents = incidents.filter((incident) =>
    WEEKEND_DAYS.has(incident.dayStarted),
  ).length;

  if (weekendIncidents / incidents.length >= 0.5) {
    return "Weekends";
  }

  let bestWindow: OperationalPattern | null = null;
  let bestCount = 0;

  for (const window of OPERATIONAL_WINDOWS) {
    const count = countIncidentsInHourRange(
      incidents,
      window.startHour,
      window.endHour,
    );

    if (count > bestCount) {
      bestCount = count;
      bestWindow = window.label;
    }
  }

  if (bestWindow && bestCount / incidents.length >= 0.4) {
    return bestWindow;
  }

  return "Random";
}

export function getPeakRiskWindow(
  timeOfDayDistribution: DistributionBucket[],
): string {
  const activeBuckets = timeOfDayDistribution.filter((bucket) => bucket.count > 0);

  if (activeBuckets.length === 0) {
    return "N/A";
  }

  let peakHour = 0;
  let peakCount = 0;

  for (const bucket of timeOfDayDistribution) {
    if (bucket.count > peakCount) {
      peakCount = bucket.count;
      peakHour = Number.parseInt(bucket.label.split(":")[0] ?? "0", 10);
    }
  }

  const windowHours = [peakHour];
  const previous = timeOfDayDistribution[peakHour - 1];
  const next = timeOfDayDistribution[peakHour + 1];

  if (previous && previous.count >= peakCount * 0.6) {
    windowHours.unshift(peakHour - 1);
  }

  if (next && next.count >= peakCount * 0.6) {
    windowHours.push(peakHour + 1);
  }

  const startHour = Math.min(...windowHours);
  const endHour = Math.max(...windowHours) + 1;

  return `${String(startHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00`;
}

export function buildDoorComplianceProfile(
  door: string,
  totalFireExitEvents: number,
  incidents: ComplianceIncident[],
): DoorComplianceProfile {
  const durations = incidents.map((incident) => incident.durationSeconds);
  const beyondThresholdValues = incidents.map(
    (incident) => incident.timeBeyondThresholdSeconds,
  );
  const timeBeyondThresholdSeconds = beyondThresholdValues.reduce(
    (sum, value) => sum + value,
    0,
  );
  const averageIncidentDurationSeconds = average(durations);
  const averageTimeBeyondThresholdSeconds = average(beyondThresholdValues);
  const longestIncidentSeconds =
    durations.length > 0 ? Math.max(...durations) : null;
  const repeatOccurrences = countRepeatOccurrences(incidents);
  const complianceScore = calculateExposureComplianceScore(
    timeBeyondThresholdSeconds,
    incidents.length,
    repeatOccurrences,
    totalFireExitEvents,
  );
  const complianceRating = getDoorHealthStatus(complianceScore) as ComplianceRating;

  const sortedIncidents = [...incidents].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );
  const lastIncident = sortedIncidents[sortedIncidents.length - 1];

  const timeOfDayDistribution = buildTimeOfDayDistribution(incidents);
  const dayOfWeekDistribution = buildDayOfWeekDistribution(incidents);
  const weeklyTrend = buildWeeklyTrend(incidents);
  const monthlyTrend = buildMonthlyTrend(incidents);
  const { riskTrend, riskTrendScore } = getRiskTrend(weeklyTrend);

  return {
    door,
    complianceScore,
    complianceRating,
    incidents,
    incidentCount: incidents.length,
    timeBeyondThresholdSeconds,
    timeBeyondThresholdLabel: formatDurationLabel(timeBeyondThresholdSeconds),
    longestIncidentSeconds,
    longestIncidentLabel: formatDurationLabel(longestIncidentSeconds),
    averageIncidentDurationSeconds,
    averageIncidentDurationLabel: formatDurationLabel(
      averageIncidentDurationSeconds,
    ),
    averageTimeBeyondThresholdSeconds,
    averageTimeBeyondThresholdLabel: formatDurationLabel(
      averageTimeBeyondThresholdSeconds,
    ),
    lastIncidentLabel: lastIncident
      ? formatEventTimeLabel(lastIncident.startTimeLabel)
      : "N/A",
    lastIncidentTimestamp: lastIncident?.startTimestamp ?? null,
    daysAffected: countDaysAffected(incidents),
    mostCommonDay: getMostCommonBucket(dayOfWeekDistribution),
    mostCommonTime: getMostCommonBucket(timeOfDayDistribution),
    peakRiskWindow: getPeakRiskWindow(timeOfDayDistribution),
    riskTrend,
    riskTrendScore,
    incidentFrequency: getIncidentFrequency(incidents),
    operationalPattern: getOperationalPattern(
      incidents,
      dayOfWeekDistribution,
      timeOfDayDistribution,
      repeatOccurrences,
    ),
    totalFireExitEvents,
    repeatOccurrences,
    timeOfDayDistribution,
    dayOfWeekDistribution,
    weeklyTrend,
    monthlyTrend,
  };
}

export function toDoorIntelligenceProfile(
  profile: DoorComplianceProfile,
): DoorIntelligenceProfile {
  const sortedIncidents = [...profile.incidents].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );

  return {
    door: profile.door,
    totalFireExitEvents: profile.totalFireExitEvents,
    totalIncidents: profile.incidentCount,
    totalHeldOpenEvents: profile.incidentCount,
    totalExposureSeconds: profile.timeBeyondThresholdSeconds,
    totalExposureLabel: profile.timeBeyondThresholdLabel,
    averageHeldOpenDurationSeconds: profile.averageIncidentDurationSeconds,
    averageHeldOpenDurationLabel: profile.averageIncidentDurationLabel,
    longestHeldOpenDurationSeconds: profile.longestIncidentSeconds,
    longestHeldOpenDurationLabel: profile.longestIncidentLabel,
    repeatOccurrences: profile.repeatOccurrences,
    daysAffected: profile.daysAffected,
    firstOccurrence: sortedIncidents[0]
      ? formatEventTimeLabel(sortedIncidents[0].startTimeLabel)
      : "N/A",
    lastOccurrence: profile.lastIncidentLabel,
    timeOfDayDistribution: profile.timeOfDayDistribution,
    dayOfWeekDistribution: profile.dayOfWeekDistribution,
    weeklyTrend: profile.weeklyTrend,
    monthlyTrend: profile.monthlyTrend,
    complianceScore: profile.complianceScore,
    status: profile.complianceRating,
    complianceProfile: profile,
    incidents: profile.incidents,
    sessions: profile.incidents,
  };
}

export function ensureDoorComplianceProfile(
  door: DoorIntelligenceProfile,
): DoorComplianceProfile {
  if (door.complianceProfile) {
    return door.complianceProfile;
  }

  const incidents = door.incidents ?? door.sessions ?? [];

  return buildDoorComplianceProfile(
    door.door,
    door.totalFireExitEvents,
    incidents,
  );
}

export function getDoorComplianceProfiles(
  report: FireExitIntelligenceReport,
): DoorComplianceProfile[] {
  if (report.doorComplianceProfiles?.length) {
    return report.doorComplianceProfiles;
  }

  return report.doors.map(ensureDoorComplianceProfile);
}

export function attachComplianceProfilesToReport(
  report: FireExitIntelligenceReport,
): FireExitIntelligenceReport {
  const doorComplianceProfiles = report.doors.map(ensureDoorComplianceProfile);
  const doors = report.doors.map((door, index) => ({
    ...door,
    complianceProfile: door.complianceProfile ?? doorComplianceProfiles[index],
  }));

  return {
    ...report,
    doors,
    doorComplianceProfiles,
  };
}
