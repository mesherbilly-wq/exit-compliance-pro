import type { FieldMapping } from "@/lib/imports/types";
import type { ImportAnalysisSnapshot } from "@/lib/imports/types";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import { normalizeIntelligenceReport } from "@/lib/analytics/normalize-intelligence";
import type {
  FireExitAnalyticsConfig,
  FireExitIntelligenceReport,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import {
  loadDoorProfilesForImport,
  loadParsedEventsForImport,
  loadParsedEventsGroupedByImports,
} from "@/lib/server/db/import-analytics-repository";
import {
  buildDedupedEventsFromImportGroups,
  buildIncidentsByDoorFromImportGroups,
} from "@/lib/analytics/build-incidents-from-imports";
import { listImportsForAnalytics } from "@/lib/server/db/latest-import";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export type AccumulatedImportAnalytics = {
  imports: ServerImportRecord[];
  primaryImport: ServerImportRecord;
  snapshot: ImportAnalysisSnapshot;
};

export async function buildAccumulatedImportAnalysisSnapshot(
  config: FireExitAnalyticsConfig = DEFAULT_ANALYTICS_CONFIG,
): Promise<AccumulatedImportAnalytics | null> {
  const imports = await listImportsForAnalytics();

  if (imports.length === 0) {
    return null;
  }

  if (imports.length === 1) {
    const primaryImport = imports[0]!;
    const snapshot = await buildImportAnalysisSnapshotFromImport(
      primaryImport,
      config,
    );

    if (!snapshot) {
      return null;
    }

    return { imports, primaryImport, snapshot };
  }

  const importIds = imports.map((record) => record.id);
  const { eventsByImportId } = await loadParsedEventsGroupedByImports(importIds);
  const parsedEvents = buildDedupedEventsFromImportGroups(eventsByImportId);
  const incidentsByDoor = buildIncidentsByDoorFromImportGroups(
    eventsByImportId,
    config,
  );
  const primaryImport = imports.at(-1)!;
  const mapping = (primaryImport.field_mapping ?? {}) as FieldMapping;

  if (parsedEvents.length === 0 || !primaryImport.field_mapping) {
    return buildAccumulatedFromSingleImportFallback(imports, config);
  }

  const totalRowCount = imports.reduce((sum, record) => sum + record.row_count, 0);
  const hasDurationField = imports.some((record) => record.has_duration_field);
  const timestamps = parsedEvents
    .map((event) => event.timestamp)
    .filter((value) => Number.isFinite(value));

  const artifacts = runFireExitIntelligenceFromParsedEvents(
    parsedEvents,
    primaryImport.headers,
    [],
    {
      sourceFileName: formatAccumulatedSourceLabel(imports.length),
      config,
      analyzedRowCount: totalRowCount,
      hasDurationField,
      mapping,
      incidentsByDoor,
    },
  );

  const intelligence = normalizeIntelligenceReport(artifacts.report);

  return {
    imports,
    primaryImport,
    snapshot: {
      mapping: intelligence.mapping,
      analyzedRowCount: totalRowCount,
      intelligence,
      parsedEvents,
      hasDurationField,
    },
  };
}

async function buildAccumulatedFromSingleImportFallback(
  imports: ServerImportRecord[],
  config: FireExitAnalyticsConfig,
): Promise<AccumulatedImportAnalytics | null> {
  const primaryImport = imports.at(-1)!;
  const snapshot = await buildImportAnalysisSnapshotFromImport(primaryImport, config);

  if (!snapshot) {
    return null;
  }

  return { imports, primaryImport, snapshot };
}

function formatAccumulatedSourceLabel(importCount: number): string {
  return `Accumulated (${importCount} imports)`;
}

export async function buildIntelligenceReportFromImport(
  record: ServerImportRecord,
  config: FireExitAnalyticsConfig = DEFAULT_ANALYTICS_CONFIG,
): Promise<FireExitIntelligenceReport | null> {
  const parsedEvents = await loadParsedEventsForImport(record.id).catch(
    (): ParsedFireExitEvent[] => [],
  );

  if (parsedEvents.length > 0 && record.field_mapping) {
    const mapping = record.field_mapping as FieldMapping;
    const artifacts = runFireExitIntelligenceFromParsedEvents(
      parsedEvents,
      record.headers,
      [],
      {
        sourceFileName: record.file_name,
        config,
        analyzedRowCount: record.row_count,
        hasDurationField: record.has_duration_field ?? false,
        mapping,
      },
    );

    return normalizeIntelligenceReport(artifacts.report);
  }

  const doors = await loadDoorProfilesForImport(record.id);

  if (doors.length > 0) {
    return rebuildFromDoorProfiles(record, doors, config);
  }

  if (record.analysis_snapshot) {
    const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot;
    if (snapshot.intelligence) {
      return normalizeIntelligenceReport(snapshot.intelligence);
    }
  }

  return null;
}

function rebuildFromDoorProfiles(
  record: ServerImportRecord,
  doors: FireExitIntelligenceReport["doors"],
  config: FireExitAnalyticsConfig,
): FireExitIntelligenceReport {
  const totalFireExitEvents = doors.reduce(
    (sum, door) => sum + door.totalFireExitEvents,
    0,
  );
  const totalHeldOpenEvents = doors.reduce(
    (sum, door) => sum + door.totalIncidents,
    0,
  );
  const totalExposureSeconds = doors.reduce(
    (sum, door) => sum + door.totalExposureSeconds,
    0,
  );

  const overallComplianceScore =
    doors.length > 0
      ? Math.round(
          doors.reduce((sum, door) => sum + door.complianceScore, 0) / doors.length,
        )
      : 100;

  const mapping = (record.field_mapping ?? {}) as FieldMapping;

  return normalizeIntelligenceReport({
    config,
    mapping,
    sourceFileName: record.file_name,
    analyzedRowCount: record.row_count,
    analyzedAt: record.created_at,
    doors,
    doorComplianceProfiles: doors
      .map((door) => door.complianceProfile)
      .filter((profile): profile is NonNullable<typeof profile> => !!profile),
    summary: {
      totalDoors: doors.length,
      doorsWithViolations: doors.filter((door) => door.totalIncidents > 0).length,
      totalFireExitEvents,
      totalHeldOpenEvents,
      totalExposureSeconds,
      totalExposureLabel: formatExposureLabel(totalExposureSeconds),
      overallComplianceScore,
      excellentDoors: doors.filter((door) => door.status === "Excellent").length,
      doorsNeedingAttention: doors.filter(
        (door) => door.status === "Needs Attention",
      ).length,
      criticalDoors: doors.filter((door) => door.status === "Critical").length,
      worstDoor:
        [...doors].sort(
          (a, b) => a.complianceScore - b.complianceScore,
        )[0]?.door ?? "N/A",
      hasDurationField: record.has_duration_field ?? false,
    },
  });
}

export async function buildImportAnalysisSnapshotFromImport(
  record: ServerImportRecord,
  config: FireExitAnalyticsConfig = DEFAULT_ANALYTICS_CONFIG,
): Promise<ImportAnalysisSnapshot | null> {
  const intelligence = await buildIntelligenceReportFromImport(record, config);

  if (!intelligence) {
    return null;
  }

  let parsedEvents: ParsedFireExitEvent[] = [];
  try {
    parsedEvents = await loadParsedEventsForImport(record.id);
  } catch {
    const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot | null;
    parsedEvents = snapshot?.parsedEvents ?? [];
  }

  return {
    mapping: intelligence.mapping,
    analyzedRowCount: record.row_count,
    intelligence,
    parsedEvents,
    hasDurationField: intelligence.summary.hasDurationField,
  };
}

function formatExposureLabel(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
