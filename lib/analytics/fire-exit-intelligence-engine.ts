import type { CsvRow, FieldMapping } from "@/lib/imports/types";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import { getAnalyticsConfig } from "./config";
import { buildDoorIntelligenceProfile } from "./scoring";
import { buildHeldOpenSessions } from "./held-open-sessions";
import { groupEventsByDoor, parseFireExitEvents } from "./parse-events";
import type {
  FireExitAnalyticsConfig,
  FireExitIntelligenceReport,
  FireExitPortfolioSummary,
} from "./types";

export type RunFireExitIntelligenceOptions = {
  sourceFileName: string;
  config?: FireExitAnalyticsConfig;
  savedMapping?: FieldMapping | null;
};

export function runFireExitIntelligenceEngine(
  rows: CsvRow[],
  headers: string[],
  options: RunFireExitIntelligenceOptions,
): FireExitIntelligenceReport {
  const config = options.config ?? getAnalyticsConfig();
  const mapping = resolveFieldMapping(headers, rows, options.savedMapping);
  const { events, hasDurationField } = parseFireExitEvents(rows, mapping, headers);
  const grouped = groupEventsByDoor(events);

  const doorNames = new Set<string>();
  for (const row of rows) {
    const doorColumn = mapping.doorName;
    const door = doorColumn ? row[doorColumn]?.trim() : "";
    if (door) {
      doorNames.add(door);
    }
  }

  for (const door of grouped.keys()) {
    doorNames.add(door);
  }

  const doors = [...doorNames]
    .sort((a, b) => a.localeCompare(b))
    .map((door) => {
      const doorEvents = grouped.get(door) ?? [];
      const sessions = buildHeldOpenSessions(doorEvents, config);
      const totalFireExitEvents = doorEvents.length;

      return buildDoorIntelligenceProfile(door, totalFireExitEvents, sessions);
    });

  const summary = buildPortfolioSummary(
    doors,
    rows.length,
    hasDurationField,
    config,
  );

  return {
    config,
    mapping,
    sourceFileName: options.sourceFileName,
    analyzedRowCount: rows.length,
    analyzedAt: new Date().toISOString(),
    doors,
    summary,
  };
}

function buildPortfolioSummary(
  doors: FireExitIntelligenceReport["doors"],
  totalEvents: number,
  hasDurationField: boolean,
  config: FireExitAnalyticsConfig,
): FireExitPortfolioSummary {
  const doorsWithViolations = doors.filter((door) => door.totalHeldOpenEvents > 0);
  const totalExposureSeconds = doors.reduce(
    (sum, door) => sum + door.totalExposureSeconds,
    0,
  );
  const totalHeldOpenEvents = doors.reduce(
    (sum, door) => sum + door.totalHeldOpenEvents,
    0,
  );
  const excellentDoors = doors.filter((door) => door.status === "Excellent").length;
  const doorsNeedingAttention = doors.filter(
    (door) => door.status === "Needs Attention",
  ).length;
  const criticalDoors = doors.filter((door) => door.status === "Critical").length;

  const overallComplianceScore =
    doors.length > 0
      ? Math.round(
          doors.reduce((sum, door) => sum + door.complianceScore, 0) / doors.length,
        )
      : 100;

  const worstDoor =
    [...doors]
      .sort((a, b) => {
        if (a.complianceScore !== b.complianceScore) {
          return a.complianceScore - b.complianceScore;
        }

        return b.totalExposureSeconds - a.totalExposureSeconds;
      })[0]?.door ?? "N/A";

  return {
    totalDoors: doors.length,
    doorsWithViolations: doorsWithViolations.length,
    totalFireExitEvents: totalEvents,
    totalHeldOpenEvents,
    totalExposureSeconds,
    totalExposureLabel: formatDurationLabel(totalExposureSeconds),
    overallComplianceScore,
    excellentDoors,
    doorsNeedingAttention,
    criticalDoors,
    worstDoor,
    hasDurationField,
  };
}

export function canRunFireExitIntelligence(
  rows: CsvRow[],
  mapping: FieldMapping | null,
): boolean {
  if (!mapping || rows.length === 0) {
    return false;
  }

  return (
    mapping.eventTime.trim() !== "" &&
    mapping.eventType.trim() !== "" &&
    mapping.doorName.trim() !== ""
  );
}
