import type { CsvRow, FieldMapping } from "@/lib/imports/types";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import { getAnalyticsConfig } from "./config";
import { attachComplianceProfilesToReport } from "./door-compliance-profile";
import { buildDoorIntelligenceProfile } from "./scoring";
import { buildComplianceIncidents } from "./compliance-incidents";
import { groupEventsByDoor, parseFireExitEvents } from "./parse-events";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  FireExitIntelligenceReport,
  FireExitPortfolioSummary,
  ParsedFireExitEvent,
} from "./types";

export type RunFireExitIntelligenceOptions = {
  sourceFileName: string;
  config?: FireExitAnalyticsConfig;
  savedMapping?: FieldMapping | null;
};

export type FireExitIntelligenceArtifacts = {
  report: FireExitIntelligenceReport;
  parsedEvents: ParsedFireExitEvent[];
  hasDurationField: boolean;
};

function collectDoorNames(
  rows: CsvRow[],
  mapping: FieldMapping,
  grouped: Map<string, ParsedFireExitEvent[]>,
): Set<string> {
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

  for (const event of grouped.values()) {
    for (const parsedEvent of event) {
      doorNames.add(parsedEvent.door);
    }
  }

  return doorNames;
}

function buildReportFromEvents(
  events: ParsedFireExitEvent[],
  doorNames: Set<string>,
  config: FireExitAnalyticsConfig,
  mapping: FieldMapping,
  sourceFileName: string,
  analyzedRowCount: number,
  hasDurationField: boolean,
  incidentsByDoor?: Map<string, ComplianceIncident[]>,
): FireExitIntelligenceReport {
  const grouped = groupEventsByDoor(events);

  const doors = [...doorNames]
    .sort((a, b) => a.localeCompare(b))
    .map((door) => {
      const doorEvents = grouped.get(door) ?? [];
      const incidents = incidentsByDoor
        ? (incidentsByDoor.get(door) ?? [])
        : buildComplianceIncidents(doorEvents, config);
      const totalFireExitEvents = doorEvents.length;

      return buildDoorIntelligenceProfile(door, totalFireExitEvents, incidents);
    });

  const summary = buildPortfolioSummary(
    doors,
    analyzedRowCount,
    hasDurationField,
  );

  return attachComplianceProfilesToReport({
    config,
    mapping,
    sourceFileName,
    analyzedRowCount,
    analyzedAt: new Date().toISOString(),
    doors,
    summary,
  });
}

function buildPortfolioSummary(
  doors: FireExitIntelligenceReport["doors"],
  totalEvents: number,
  hasDurationField: boolean,
): FireExitPortfolioSummary {
  const doorsWithViolations = doors.filter((door) => door.totalIncidents > 0);
  const totalExposureSeconds = doors.reduce(
    (sum, door) => sum + door.totalExposureSeconds,
    0,
  );
  const totalHeldOpenEvents = doors.reduce(
    (sum, door) => sum + door.totalIncidents,
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

export function runFireExitIntelligenceFromParsedEvents(
  events: ParsedFireExitEvent[],
  headers: string[],
  rowsForDoorNames: CsvRow[],
  options: RunFireExitIntelligenceOptions & {
    analyzedRowCount: number;
    hasDurationField: boolean;
    mapping?: FieldMapping;
    incidentsByDoor?: Map<string, ComplianceIncident[]>;
  },
): FireExitIntelligenceArtifacts {
  const config = options.config ?? getAnalyticsConfig();
  const mapping =
    options.mapping ??
    resolveFieldMapping(headers, rowsForDoorNames, options.savedMapping);
  const grouped = groupEventsByDoor(events);
  const doorNames = collectDoorNames(rowsForDoorNames, mapping, grouped);

  const report = buildReportFromEvents(
    events,
    doorNames,
    config,
    mapping,
    options.sourceFileName,
    options.analyzedRowCount,
    options.hasDurationField,
    options.incidentsByDoor,
  );

  return {
    report,
    parsedEvents: events,
    hasDurationField: options.hasDurationField,
  };
}

export function runFireExitIntelligenceEngine(
  rows: CsvRow[],
  headers: string[],
  options: RunFireExitIntelligenceOptions,
): FireExitIntelligenceReport {
  return runFireExitIntelligenceWithArtifacts(rows, headers, options).report;
}

export function runFireExitIntelligenceWithArtifacts(
  rows: CsvRow[],
  headers: string[],
  options: RunFireExitIntelligenceOptions,
): FireExitIntelligenceArtifacts {
  const mapping = resolveFieldMapping(headers, rows, options.savedMapping);
  const { events, hasDurationField } = parseFireExitEvents(rows, mapping, headers);

  return runFireExitIntelligenceFromParsedEvents(events, headers, rows, {
    ...options,
    analyzedRowCount: rows.length,
    hasDurationField,
    mapping,
  });
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

export function refreshIntelligenceReportWithConfig(
  snapshot: {
    parsedEvents?: ParsedFireExitEvent[];
    hasDurationField?: boolean;
    analyzedRowCount: number;
    mapping: FieldMapping;
    intelligence: FireExitIntelligenceReport;
  },
  headers: string[],
  fileName: string,
  config: FireExitAnalyticsConfig,
): FireExitIntelligenceArtifacts | null {
  if (!snapshot.parsedEvents || snapshot.parsedEvents.length === 0) {
    return null;
  }

  return runFireExitIntelligenceFromParsedEvents(
    snapshot.parsedEvents,
    headers,
    [],
    {
      sourceFileName: fileName,
      config,
      analyzedRowCount: snapshot.analyzedRowCount,
      hasDurationField: snapshot.hasDurationField ?? false,
      mapping: snapshot.mapping,
    },
  );
}
