import type { FireExitIntelligenceReport } from "@/lib/analytics/types";
import { normalizeIntelligenceReport, getDoorIncidents } from "@/lib/analytics/normalize-intelligence";
import { buildComplianceIntelligenceDashboard } from "@/lib/analytics/compliance-intelligence";
import type { ComplianceIntelligenceDashboard } from "@/lib/analytics/compliance-intelligence";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import { formatEventTimeLabel } from "@/lib/reports/door-event-analysis";
import { getDoorComplianceStatus } from "@/lib/reports/held-open-detection";
import type {
  DoorHealthAnalysis,
  DoorHealthRecord,
  DoorSortKey,
} from "@/lib/reports/analyze-door-health";
import type {
  ExitComplianceAnalysis,
} from "@/lib/reports/analyze-exit-compliance";
import type {
  FireExitDashboardAnalysis,
  HeldOpenEvent,
  ProblemDoor,
} from "@/lib/reports/analyze-fire-exit-dashboard";

export function toDoorHealthAnalysis(
  report: FireExitIntelligenceReport,
): DoorHealthAnalysis {
  const normalized = normalizeIntelligenceReport(report);
  const doors: DoorHealthRecord[] = normalized.doors.map((door) => ({
    door: door.door,
    totalEvents: door.totalFireExitEvents,
    heldOpenEvents: door.totalIncidents,
    averageDurationSeconds: door.averageHeldOpenDurationSeconds,
    averageDurationLabel: door.averageHeldOpenDurationLabel,
    longestDurationSeconds: door.longestHeldOpenDurationSeconds,
    longestDurationLabel: door.longestHeldOpenDurationLabel,
    lastEventTime: door.lastOccurrence,
    complianceScore: door.complianceScore,
    status: door.status,
    totalExposureSeconds: door.totalExposureSeconds,
    totalExposureLabel: door.totalExposureLabel,
    repeatOccurrences: door.repeatOccurrences,
    daysAffected: door.daysAffected,
    firstOccurrence: door.firstOccurrence,
    timeOfDayDistribution: door.timeOfDayDistribution,
    dayOfWeekDistribution: door.dayOfWeekDistribution,
    weeklyTrend: door.weeklyTrend,
    monthlyTrend: door.monthlyTrend,
  }));

  return {
    doors,
    totalDoors: normalized.summary.totalDoors,
    excellentDoors: normalized.summary.excellentDoors,
    doorsNeedingAttention: normalized.summary.doorsNeedingAttention,
    criticalDoors: normalized.summary.criticalDoors,
    worstDoor: normalized.summary.worstDoor,
    sourceFileName: normalized.sourceFileName,
    hasDurationField: normalized.summary.hasDurationField,
    intelligence: normalized,
  };
}

export function toFireExitDashboardAnalysis(
  report: FireExitIntelligenceReport,
): FireExitDashboardAnalysis {
  const normalized = normalizeIntelligenceReport(report);

  const problemDoors: ProblemDoor[] = normalized.doors
    .filter((door) => door.totalIncidents > 0)
    .map((door) => ({
      door: door.door,
      heldOpenEvents: door.totalIncidents,
      averageDurationSeconds: door.averageHeldOpenDurationSeconds,
      averageDurationLabel: door.averageHeldOpenDurationLabel,
      longestDurationSeconds: door.longestHeldOpenDurationSeconds,
      longestDurationLabel: door.longestHeldOpenDurationLabel,
      complianceScore: door.complianceScore,
      status: getDoorComplianceStatus(door.complianceScore),
      totalExposureLabel: door.totalExposureLabel,
    }))
    .sort((a, b) => {
      if (b.heldOpenEvents !== a.heldOpenEvents) {
        return b.heldOpenEvents - a.heldOpenEvents;
      }

      return a.complianceScore - b.complianceScore;
    });

  const recentExceptions: HeldOpenEvent[] = normalized.doors
    .flatMap((door) =>
      getDoorIncidents(door).map((incident) => ({
        time: formatEventTimeLabel(incident.startTimeLabel),
        door: door.door,
        eventType: incident.eventType,
        durationSeconds: incident.durationSeconds,
        durationLabel: formatDurationLabel(incident.durationSeconds),
        exposureLabel: formatDurationLabel(incident.timeBeyondThresholdSeconds),
      })),
    )
    .sort((a, b) => {
      const timeA = Date.parse(a.time);
      const timeB = Date.parse(b.time);
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
        return timeB - timeA;
      }

      return 0;
    })
    .slice(0, 15);

  const violationDurations = normalized.doors.flatMap((door) =>
    getDoorIncidents(door).map((incident) => incident.durationSeconds),
  );
  const averageDuration =
    violationDurations.length > 0
      ? violationDurations.reduce((sum, value) => sum + value, 0) /
        violationDurations.length
      : null;

  return {
    overallComplianceScore: normalized.summary.overallComplianceScore,
    doorsMonitored: normalized.summary.totalDoors,
    eventsAnalysed: normalized.analyzedRowCount,
    heldOpenEvents: normalized.summary.totalHeldOpenEvents,
    averageOpenDurationSeconds: averageDuration,
    averageOpenDurationLabel: formatDurationLabel(averageDuration),
    totalExposureLabel: normalized.summary.totalExposureLabel,
    worstPerformingDoor: normalized.summary.worstDoor,
    problemDoors,
    recentExceptions,
    sourceFileName: normalized.sourceFileName,
    intelligence: normalized,
  };
}

export function toExitComplianceAnalysis(
  report: FireExitIntelligenceReport,
): ExitComplianceAnalysis {
  const normalized = normalizeIntelligenceReport(report);
  const dashboard = buildComplianceIntelligenceDashboard(normalized);

  const doorBreakdown = normalized.doors
    .filter((door) => door.totalIncidents > 0)
    .map((door) => ({
      door: door.door,
      count: door.totalIncidents,
      exposureLabel: door.totalExposureLabel,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentExceptions = normalized.doors
    .flatMap((door) =>
      getDoorIncidents(door).map((incident) => ({
        time: formatEventTimeLabel(incident.startTimeLabel),
        type: incident.eventType,
        door: door.door,
        result: `Time beyond threshold ${formatDurationLabel(incident.timeBeyondThresholdSeconds)}`,
      })),
    )
    .slice(0, 15);

  return {
    totalEvents: normalized.analyzedRowCount,
    uniqueDoors: normalized.summary.totalDoors,
    forcedOpenEvents: 0,
    heldOpenEvents: normalized.summary.totalHeldOpenEvents,
    lifeSafetyExceptions: normalized.summary.totalHeldOpenEvents,
    otherEvents: normalized.analyzedRowCount - normalized.summary.totalHeldOpenEvents,
    totalExposureLabel: normalized.summary.totalExposureLabel,
    doorBreakdown,
    recentExceptions,
    intelligence: normalized,
    complianceDashboard: dashboard,
  };
}

export function sortDoorProfiles<
  T extends {
    complianceScore: number;
    heldOpenEvents: number;
    longestDurationSeconds: number | null;
  },
>(doors: T[], sortBy: DoorSortKey): T[] {
  return [...doors].sort((a, b) => {
    if (sortBy === "score") {
      return a.complianceScore - b.complianceScore;
    }

    if (sortBy === "heldOpen") {
      return b.heldOpenEvents - a.heldOpenEvents;
    }

    return (
      (b.longestDurationSeconds ?? 0) - (a.longestDurationSeconds ?? 0)
    );
  });
}
