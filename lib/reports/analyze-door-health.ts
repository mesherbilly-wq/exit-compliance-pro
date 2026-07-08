import type { FieldMapping } from "@/lib/imports/types";
import {
  calculateDoorComplianceScore,
  findDurationColumn,
  formatDuration,
  getDoorHealthStatus,
  isHeldOpenEvent,
  parseDurationSeconds,
  type DoorHealthStatus,
} from "./held-open-detection";

export type CsvRow = Record<string, string>;

export type DoorHealthRecord = {
  door: string;
  totalEvents: number;
  heldOpenEvents: number;
  averageDurationSeconds: number | null;
  averageDurationLabel: string;
  longestDurationSeconds: number | null;
  longestDurationLabel: string;
  lastEventTime: string;
  complianceScore: number;
  status: DoorHealthStatus;
};

export type DoorHealthAnalysis = {
  doors: DoorHealthRecord[];
  totalDoors: number;
  excellentDoors: number;
  doorsNeedingAttention: number;
  criticalDoors: number;
  worstDoor: string;
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

function isNewerEventTime(current: string, candidate: string): boolean {
  if (!candidate) return false;
  if (!current) return true;

  const currentTime = Date.parse(current);
  const candidateTime = Date.parse(candidate);

  if (!Number.isNaN(currentTime) && !Number.isNaN(candidateTime)) {
    return candidateTime > currentTime;
  }

  return candidate > current;
}

export function analyzeDoorHealth(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
  sourceFileName: string,
): DoorHealthAnalysis {
  const durationColumn = findDurationColumn(headers);
  const doorStats = new Map<
    string,
    {
      totalEvents: number;
      heldOpenEvents: number;
      durations: number[];
      lastEventTime: string;
    }
  >();

  for (const row of rows) {
    const eventType = getFieldValue(row, mapping, "eventType");
    const doorName = getFieldValue(row, mapping, "doorName") || "Unknown exit door";
    const eventTime = getFieldValue(row, mapping, "eventTime");
    const accessResult = getFieldValue(row, mapping, "accessResult");

    const stats = doorStats.get(doorName) ?? {
      totalEvents: 0,
      heldOpenEvents: 0,
      durations: [],
      lastEventTime: "",
    };

    stats.totalEvents += 1;

    if (isNewerEventTime(stats.lastEventTime, eventTime)) {
      stats.lastEventTime = eventTime;
    }

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
    }

    doorStats.set(doorName, stats);
  }

  const doors: DoorHealthRecord[] = [...doorStats.entries()].map(
    ([door, stats]) => {
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
        totalEvents: stats.totalEvents,
        heldOpenEvents: stats.heldOpenEvents,
        averageDurationSeconds,
        averageDurationLabel: formatDuration(averageDurationSeconds),
        longestDurationSeconds,
        longestDurationLabel: formatDuration(longestDurationSeconds),
        lastEventTime: stats.lastEventTime || "—",
        complianceScore,
        status: getDoorHealthStatus(complianceScore),
      };
    },
  );

  const excellentDoors = doors.filter((door) => door.status === "Excellent").length;
  const doorsNeedingAttention = doors.filter(
    (door) => door.status === "Needs Attention",
  ).length;
  const criticalDoors = doors.filter((door) => door.status === "Critical").length;

  const worstDoor =
    [...doors].sort((a, b) => {
      if (a.complianceScore !== b.complianceScore) {
        return a.complianceScore - b.complianceScore;
      }

      return b.heldOpenEvents - a.heldOpenEvents;
    })[0]?.door ?? "—";

  return {
    doors,
    totalDoors: doors.length,
    excellentDoors,
    doorsNeedingAttention,
    criticalDoors,
    worstDoor,
    sourceFileName,
  };
}

export function canRunDoorHealthAnalysis(
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

export type DoorSortKey = "score" | "heldOpen" | "longestDuration";

export function sortDoors(
  doors: DoorHealthRecord[],
  sortBy: DoorSortKey,
): DoorHealthRecord[] {
  return [...doors].sort((a, b) => {
    if (sortBy === "score") {
      return a.complianceScore - b.complianceScore;
    }

    if (sortBy === "heldOpen") {
      return b.heldOpenEvents - a.heldOpenEvents;
    }

    return (b.longestDurationSeconds ?? 0) - (a.longestDurationSeconds ?? 0);
  });
}
