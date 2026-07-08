import type { FieldMapping } from "@/lib/imports/types";
import {
  calculateDoorComplianceScore,
  findDurationColumn,
  formatDuration,
  getDoorComplianceStatus,
  isHeldOpenEvent,
  parseDurationSeconds,
  type DoorComplianceStatus,
} from "./held-open-detection";

export type CsvRow = Record<string, string>;

export type HeldOpenEvent = {
  time: string;
  door: string;
  eventType: string;
  durationSeconds: number | null;
  durationLabel: string;
};

export type ProblemDoor = {
  door: string;
  heldOpenEvents: number;
  averageDurationSeconds: number | null;
  averageDurationLabel: string;
  longestDurationSeconds: number | null;
  longestDurationLabel: string;
  complianceScore: number;
  status: DoorComplianceStatus;
};

export type FireExitDashboardAnalysis = {
  overallComplianceScore: number;
  doorsMonitored: number;
  eventsAnalysed: number;
  heldOpenEvents: number;
  averageOpenDurationSeconds: number | null;
  averageOpenDurationLabel: string;
  worstPerformingDoor: string;
  problemDoors: ProblemDoor[];
  recentExceptions: HeldOpenEvent[];
  sourceFileName: string;
};

function getFieldValue(row: CsvRow, mapping: FieldMapping, key: keyof FieldMapping) {
  const column = mapping[key];
  return column ? row[column]?.trim() ?? "" : "";
}

function extractDuration(
  row: CsvRow,
  eventType: string,
  accessResult: string,
  durationColumn: string | null,
): number | null {
  if (durationColumn) {
    const fromColumn = parseDurationSeconds(row[durationColumn] ?? "");
    if (fromColumn !== null) {
      return fromColumn;
    }
  }

  return (
    parseDurationSeconds(eventType) ??
    parseDurationSeconds(accessResult) ??
    null
  );
}

export function analyzeFireExitDashboard(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
  sourceFileName: string,
): FireExitDashboardAnalysis {
  const durationColumn = findDurationColumn(headers);
  const doorStats = new Map<
    string,
    {
      totalEvents: number;
      heldOpenEvents: number;
      durations: number[];
    }
  >();

  const heldOpenEventsList: HeldOpenEvent[] = [];

  for (const row of rows) {
    const eventType = getFieldValue(row, mapping, "eventType");
    const doorName = getFieldValue(row, mapping, "doorName") || "Unknown exit door";
    const eventTime = getFieldValue(row, mapping, "eventTime");
    const accessResult = getFieldValue(row, mapping, "accessResult");

    const stats = doorStats.get(doorName) ?? {
      totalEvents: 0,
      heldOpenEvents: 0,
      durations: [],
    };

    stats.totalEvents += 1;

    if (isHeldOpenEvent(eventType, accessResult)) {
      const durationSeconds = extractDuration(
        row,
        eventType,
        accessResult,
        durationColumn,
      );

      stats.heldOpenEvents += 1;
      if (durationSeconds !== null) {
        stats.durations.push(durationSeconds);
      }

      heldOpenEventsList.push({
        time: eventTime || "—",
        door: doorName,
        eventType: eventType || "Held-open event",
        durationSeconds,
        durationLabel: formatDuration(durationSeconds),
      });
    }

    doorStats.set(doorName, stats);
  }

  const problemDoors: ProblemDoor[] = [...doorStats.entries()]
    .map(([door, stats]) => {
      const averageDurationSeconds =
        stats.durations.length > 0
          ? stats.durations.reduce((sum, value) => sum + value, 0) /
            stats.durations.length
          : null;
      const longestDurationSeconds =
        stats.durations.length > 0 ? Math.max(...stats.durations) : null;
      const complianceScore = calculateDoorComplianceScore(
        stats.heldOpenEvents,
        stats.totalEvents,
      );

      return {
        door,
        heldOpenEvents: stats.heldOpenEvents,
        averageDurationSeconds,
        averageDurationLabel: formatDuration(averageDurationSeconds),
        longestDurationSeconds,
        longestDurationLabel: formatDuration(longestDurationSeconds),
        complianceScore,
        status: getDoorComplianceStatus(complianceScore),
      };
    })
    .filter((door) => door.heldOpenEvents > 0)
    .sort((a, b) => {
      if (b.heldOpenEvents !== a.heldOpenEvents) {
        return b.heldOpenEvents - a.heldOpenEvents;
      }

      return a.complianceScore - b.complianceScore;
    });

  const allHeldOpenDurations = heldOpenEventsList
    .map((event) => event.durationSeconds)
    .filter((value): value is number => value !== null);

  const averageOpenDurationSeconds =
    allHeldOpenDurations.length > 0
      ? allHeldOpenDurations.reduce((sum, value) => sum + value, 0) /
        allHeldOpenDurations.length
      : null;

  const doorScores = [...doorStats.values()].map((stats) =>
    calculateDoorComplianceScore(stats.heldOpenEvents, stats.totalEvents),
  );

  const overallComplianceScore =
    doorScores.length > 0
      ? Math.round(
          doorScores.reduce((sum, score) => sum + score, 0) / doorScores.length,
        )
      : 100;

  const worstPerformingDoor =
    problemDoors[0]?.door ??
    [...doorStats.entries()]
      .map(([door, stats]) => ({
        door,
        score: calculateDoorComplianceScore(
          stats.heldOpenEvents,
          stats.totalEvents,
        ),
      }))
      .sort((a, b) => a.score - b.score)[0]?.door ??
    "—";

  return {
    overallComplianceScore,
    doorsMonitored: doorStats.size,
    eventsAnalysed: rows.length,
    heldOpenEvents: heldOpenEventsList.length,
    averageOpenDurationSeconds,
    averageOpenDurationLabel: formatDuration(averageOpenDurationSeconds),
    worstPerformingDoor,
    problemDoors,
    recentExceptions: heldOpenEventsList.slice(0, 15),
    sourceFileName,
  };
}

export function canRunFireExitDashboard(
  rows: CsvRow[],
  mapping: FieldMapping | null,
): boolean {
  if (!mapping || rows.length === 0) return false;

  return (
    mapping.eventTime.trim() !== "" &&
    mapping.eventType.trim() !== "" &&
    mapping.doorName.trim() !== ""
  );
}
