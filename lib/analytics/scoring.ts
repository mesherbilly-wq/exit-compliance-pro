import {
  formatDurationLabel,
  getDoorHealthStatus,
} from "@/lib/reports/held-open-detection";
import { formatEventTimeLabel } from "@/lib/reports/door-event-analysis";
import type { ComplianceIncident, DoorIntelligenceProfile } from "./types";
import {
  average,
  buildDayOfWeekDistribution,
  buildMonthlyTrend,
  buildTimeOfDayDistribution,
  buildWeeklyTrend,
  countDaysAffected,
  countRepeatOccurrences,
} from "./distributions";

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

export function buildDoorIntelligenceProfile(
  door: string,
  totalFireExitEvents: number,
  incidents: ComplianceIncident[],
): DoorIntelligenceProfile {
  const durations = incidents.map((incident) => incident.durationSeconds);
  const exposureTotal = incidents.reduce(
    (sum, incident) => sum + incident.timeBeyondThresholdSeconds,
    0,
  );
  const averageDuration = average(durations);
  const longestDuration = durations.length > 0 ? Math.max(...durations) : null;
  const repeatOccurrences = countRepeatOccurrences(incidents);
  const complianceScore = calculateExposureComplianceScore(
    exposureTotal,
    incidents.length,
    repeatOccurrences,
    totalFireExitEvents,
  );

  const sortedIncidents = [...incidents].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );

  return {
    door,
    totalFireExitEvents,
    totalIncidents: incidents.length,
    totalHeldOpenEvents: incidents.length,
    totalExposureSeconds: exposureTotal,
    totalExposureLabel: formatDurationLabel(exposureTotal),
    averageHeldOpenDurationSeconds: averageDuration,
    averageHeldOpenDurationLabel: formatDurationLabel(averageDuration),
    longestHeldOpenDurationSeconds: longestDuration,
    longestHeldOpenDurationLabel: formatDurationLabel(longestDuration),
    repeatOccurrences,
    daysAffected: countDaysAffected(incidents),
    firstOccurrence: sortedIncidents[0]
      ? formatEventTimeLabel(sortedIncidents[0].startTimeLabel)
      : "N/A",
    lastOccurrence: sortedIncidents[sortedIncidents.length - 1]
      ? formatEventTimeLabel(
          sortedIncidents[sortedIncidents.length - 1].startTimeLabel,
        )
      : "N/A",
    timeOfDayDistribution: buildTimeOfDayDistribution(incidents),
    dayOfWeekDistribution: buildDayOfWeekDistribution(incidents),
    weeklyTrend: buildWeeklyTrend(incidents),
    monthlyTrend: buildMonthlyTrend(incidents),
    complianceScore,
    status: getDoorHealthStatus(complianceScore),
    incidents,
    sessions: incidents,
  };
}
