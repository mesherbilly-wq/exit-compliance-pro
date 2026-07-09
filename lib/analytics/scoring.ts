import {
  formatDurationLabel,
  getDoorHealthStatus,
} from "@/lib/reports/held-open-detection";
import { formatEventTimeLabel } from "@/lib/reports/door-event-analysis";
import type { DoorIntelligenceProfile, HeldOpenSession } from "./types";
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
  sessions: HeldOpenSession[],
): DoorIntelligenceProfile {
  const durations = sessions.map((session) => session.durationSeconds);
  const exposureTotal = sessions.reduce(
    (sum, session) => sum + session.exposureSeconds,
    0,
  );
  const averageDuration = average(durations);
  const longestDuration = durations.length > 0 ? Math.max(...durations) : null;
  const repeatOccurrences = countRepeatOccurrences(sessions);
  const complianceScore = calculateExposureComplianceScore(
    exposureTotal,
    sessions.length,
    repeatOccurrences,
    totalFireExitEvents,
  );

  const sortedSessions = [...sessions].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );

  return {
    door,
    totalFireExitEvents,
    totalHeldOpenEvents: sessions.length,
    totalExposureSeconds: exposureTotal,
    totalExposureLabel: formatDurationLabel(exposureTotal),
    averageHeldOpenDurationSeconds: averageDuration,
    averageHeldOpenDurationLabel: formatDurationLabel(averageDuration),
    longestHeldOpenDurationSeconds: longestDuration,
    longestHeldOpenDurationLabel: formatDurationLabel(longestDuration),
    repeatOccurrences,
    daysAffected: countDaysAffected(sessions),
    firstOccurrence: sortedSessions[0]
      ? formatEventTimeLabel(sortedSessions[0].startTimeLabel)
      : "N/A",
    lastOccurrence: sortedSessions[sortedSessions.length - 1]
      ? formatEventTimeLabel(
          sortedSessions[sortedSessions.length - 1].startTimeLabel,
        )
      : "N/A",
    timeOfDayDistribution: buildTimeOfDayDistribution(sessions),
    dayOfWeekDistribution: buildDayOfWeekDistribution(sessions),
    weeklyTrend: buildWeeklyTrend(sessions),
    monthlyTrend: buildMonthlyTrend(sessions),
    complianceScore,
    status: getDoorHealthStatus(complianceScore),
    sessions,
  };
}
