import type { FireExitIntelligenceReport } from "@/lib/analytics/types";
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
  const doors: DoorHealthRecord[] = report.doors.map((door) => ({
    door: door.door,
    totalEvents: door.totalFireExitEvents,
    heldOpenEvents: door.totalHeldOpenEvents,
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
    totalDoors: report.summary.totalDoors,
    excellentDoors: report.summary.excellentDoors,
    doorsNeedingAttention: report.summary.doorsNeedingAttention,
    criticalDoors: report.summary.criticalDoors,
    worstDoor: report.summary.worstDoor,
    sourceFileName: report.sourceFileName,
    hasDurationField: report.summary.hasDurationField,
    intelligence: report,
  };
}

export function toFireExitDashboardAnalysis(
  report: FireExitIntelligenceReport,
): FireExitDashboardAnalysis {
  const problemDoors: ProblemDoor[] = report.doors
    .filter((door) => door.totalHeldOpenEvents > 0)
    .map((door) => ({
      door: door.door,
      heldOpenEvents: door.totalHeldOpenEvents,
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

  const recentExceptions: HeldOpenEvent[] = report.doors
    .flatMap((door) =>
      door.sessions.map((session) => ({
        time: formatEventTimeLabel(session.startTimeLabel),
        door: door.door,
        eventType: session.eventType,
        durationSeconds: session.durationSeconds,
        durationLabel: formatDurationLabel(session.durationSeconds),
        exposureLabel: formatDurationLabel(session.exposureSeconds),
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

  const violationDurations = report.doors.flatMap((door) =>
    door.sessions.map((session) => session.durationSeconds),
  );
  const averageDuration =
    violationDurations.length > 0
      ? violationDurations.reduce((sum, value) => sum + value, 0) /
        violationDurations.length
      : null;

  return {
    overallComplianceScore: report.summary.overallComplianceScore,
    doorsMonitored: report.summary.totalDoors,
    eventsAnalysed: report.analyzedRowCount,
    heldOpenEvents: report.summary.totalHeldOpenEvents,
    averageOpenDurationSeconds: averageDuration,
    averageOpenDurationLabel: formatDurationLabel(averageDuration),
    totalExposureLabel: report.summary.totalExposureLabel,
    worstPerformingDoor: report.summary.worstDoor,
    problemDoors,
    recentExceptions,
    sourceFileName: report.sourceFileName,
    intelligence: report,
  };
}

export function toExitComplianceAnalysis(
  report: FireExitIntelligenceReport,
): ExitComplianceAnalysis {
  const dashboard = buildComplianceIntelligenceDashboard(report);

  const doorBreakdown = report.doors
    .filter((door) => door.totalHeldOpenEvents > 0)
    .map((door) => ({
      door: door.door,
      count: door.totalHeldOpenEvents,
      exposureLabel: door.totalExposureLabel,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentExceptions = report.doors
    .flatMap((door) =>
      door.sessions.map((session) => ({
        time: formatEventTimeLabel(session.startTimeLabel),
        type: session.eventType,
        door: door.door,
        result: `Exposure ${formatDurationLabel(session.exposureSeconds)}`,
      })),
    )
    .slice(0, 15);

  return {
    totalEvents: report.analyzedRowCount,
    uniqueDoors: report.summary.totalDoors,
    forcedOpenEvents: 0,
    heldOpenEvents: report.summary.totalHeldOpenEvents,
    lifeSafetyExceptions: report.summary.totalHeldOpenEvents,
    otherEvents: report.analyzedRowCount - report.summary.totalHeldOpenEvents,
    totalExposureLabel: report.summary.totalExposureLabel,
    doorBreakdown,
    recentExceptions,
    intelligence: report,
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
