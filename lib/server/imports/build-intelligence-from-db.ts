import type { FieldMapping } from "@/lib/imports/types";
import type { ImportAnalysisSnapshot } from "@/lib/imports/types";
import { ANALYTICS_ENGINE_VERSION } from "@/lib/analytics/analytics-engine-version";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import {
  buildCanonicalIncidentsByDoor,
  type ImportContext,
} from "@/lib/analytics/canonical-incident-engine";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import { normalizeIntelligenceReport } from "@/lib/analytics/normalize-intelligence";
import type {
  FireExitAnalyticsConfig,
  FireExitIntelligenceReport,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import {
  loadDoorProfilesForImport,
  loadDoorProfilesForImports,
  loadParsedEventsForImport,
  loadParsedEventsGroupedByImports,
} from "@/lib/server/db/import-analytics-repository";
import {
  getEventLoadOptionsForRetention,
  listImportsForAnalytics,
} from "@/lib/server/db/latest-import";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import {
  buildAccumulatedAnalyticsCacheKey,
  getCachedAccumulatedAnalytics,
  setCachedAccumulatedAnalytics,
} from "@/lib/server/imports/accumulated-analytics-cache";
import {
  type AccumulatedImportAnalytics,
  toClientImportAnalysisSnapshot,
} from "@/lib/server/imports/import-analysis-snapshot";
import {
  buildIntelligenceReportFromDoorProfiles,
  rebuildStoredProfilesForRetention,
} from "@/lib/server/imports/merge-stored-door-profiles";

export type { AccumulatedImportAnalytics };

function toImportContext(record: ServerImportRecord): ImportContext {
  return {
    importId: record.id,
    reportingPeriodStart: record.reporting_period_start,
    reportingPeriodEnd: record.reporting_period_end,
    createdAt: record.created_at,
  };
}

function buildImportContextMap(
  imports: ServerImportRecord[],
): Map<string, ImportContext> {
  return new Map(imports.map((record) => [record.id, toImportContext(record)]));
}

export function importsAnalyticsAreFresh(
  imports: ServerImportRecord[],
  config: FireExitAnalyticsConfig,
): boolean {
  return imports.every(
    (record) =>
      record.has_analytics &&
      Boolean(record.field_mapping) &&
      (record.analytics_engine_version ?? null) === ANALYTICS_ENGINE_VERSION &&
      (record.analytics_threshold_seconds ??
        DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds) ===
        config.heldOpenThresholdSeconds,
  );
}

function runIntelligenceWithCanonicalIncidents(input: {
  eventsByImportId: Map<string, ParsedFireExitEvent[]>;
  importContexts: Map<string, ImportContext>;
  config: FireExitAnalyticsConfig;
  headers: string[];
  sourceFileName: string;
  analyzedRowCount: number;
  hasDurationField: boolean;
  mapping: FieldMapping;
}): FireExitIntelligenceReport {
  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId: input.eventsByImportId,
    importContexts: input.importContexts,
    config: input.config,
  });

  const artifacts = runFireExitIntelligenceFromParsedEvents(
    canonical.dedupedEvents,
    input.headers,
    [],
    {
      sourceFileName: input.sourceFileName,
      config: input.config,
      analyzedRowCount: input.analyzedRowCount,
      hasDurationField: input.hasDurationField,
      mapping: input.mapping,
      incidentsByDoor: canonical.incidentsByDoor,
    },
  );

  return normalizeIntelligenceReport(artifacts.report);
}

function formatAccumulatedSourceLabel(importCount: number): string {
  return `Accumulated (${importCount} imports)`;
}

function wrapAccumulatedResult(
  imports: ServerImportRecord[],
  snapshot: ImportAnalysisSnapshot,
): AccumulatedImportAnalytics {
  return {
    imports,
    primaryImport: imports.at(-1)!,
    snapshot: toClientImportAnalysisSnapshot(snapshot),
  };
}

async function buildAccumulatedFromStoredDoorProfiles(
  imports: ServerImportRecord[],
  config: FireExitAnalyticsConfig,
): Promise<AccumulatedImportAnalytics | null> {
  const importIds = imports.map((record) => record.id);
  const eventLoadOptions = getEventLoadOptionsForRetention(config);
  const [{ eventsByImportId }, profilesByImport] = await Promise.all([
    loadParsedEventsGroupedByImports(importIds, eventLoadOptions),
    loadDoorProfilesForImports(importIds),
  ]);
  const storedProfiles = [...profilesByImport.values()].flat();

  if (storedProfiles.length === 0) {
    return null;
  }

  const primaryImport = imports.at(-1)!;
  const mapping = (primaryImport.field_mapping ?? {}) as FieldMapping;
  const totalRowCount = imports.reduce((sum, record) => sum + record.row_count, 0);
  const hasDurationField = imports.some((record) => record.has_duration_field);

  const rebuiltDoors = rebuildStoredProfilesForRetention({
    profiles: storedProfiles,
    eventsByImportId,
    config,
  });

  if (rebuiltDoors.length === 0) {
    return null;
  }

  const intelligence = buildIntelligenceReportFromDoorProfiles({
    doors: rebuiltDoors,
    config,
    mapping,
    sourceFileName:
      imports.length === 1
        ? primaryImport.file_name
        : formatAccumulatedSourceLabel(imports.length),
    analyzedRowCount: totalRowCount,
    hasDurationField,
    analyzedAt: primaryImport.created_at,
  });

  return wrapAccumulatedResult(imports, {
    mapping: intelligence.mapping,
    analyzedRowCount: totalRowCount,
    intelligence,
    hasDurationField,
  });
}

async function buildAccumulatedFromLiveEvents(
  imports: ServerImportRecord[],
  config: FireExitAnalyticsConfig,
): Promise<AccumulatedImportAnalytics | null> {
  const importIds = imports.map((record) => record.id);
  const importContexts = buildImportContextMap(imports);
  const { eventsByImportId } = await loadParsedEventsGroupedByImports(
    importIds,
    getEventLoadOptionsForRetention(config),
  );
  const primaryImport = imports.at(-1)!;
  const mapping = (primaryImport.field_mapping ?? {}) as FieldMapping;

  const totalEvents = [...eventsByImportId.values()].reduce(
    (sum, events) => sum + events.length,
    0,
  );

  if (totalEvents === 0 || !primaryImport.field_mapping) {
    return buildAccumulatedFromSingleImportFallback(imports, config);
  }

  const totalRowCount = imports.reduce((sum, record) => sum + record.row_count, 0);
  const hasDurationField = imports.some((record) => record.has_duration_field);

  const intelligence = runIntelligenceWithCanonicalIncidents({
    eventsByImportId,
    importContexts,
    config,
    headers: primaryImport.headers,
    sourceFileName:
      imports.length === 1
        ? primaryImport.file_name
        : formatAccumulatedSourceLabel(imports.length),
    analyzedRowCount: totalRowCount,
    hasDurationField,
    mapping,
  });

  return wrapAccumulatedResult(imports, {
    mapping: intelligence.mapping,
    analyzedRowCount: totalRowCount,
    intelligence,
    hasDurationField,
  });
}

export async function buildAccumulatedImportAnalysisSnapshot(
  config: FireExitAnalyticsConfig = DEFAULT_ANALYTICS_CONFIG,
): Promise<AccumulatedImportAnalytics | null> {
  const imports = await listImportsForAnalytics(config);

  if (imports.length === 0) {
    return null;
  }

  const cacheKey = buildAccumulatedAnalyticsCacheKey(imports, config);
  const cached = getCachedAccumulatedAnalytics(cacheKey);
  if (cached) {
    return cached;
  }

  let result: AccumulatedImportAnalytics | null = null;

  if (importsAnalyticsAreFresh(imports, config)) {
    result = await buildAccumulatedFromStoredDoorProfiles(imports, config);
  }

  if (!result) {
    result = await buildAccumulatedFromLiveEvents(imports, config);
  }

  if (result) {
    setCachedAccumulatedAnalytics(cacheKey, result);
  }

  return result;
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

  return wrapAccumulatedResult(imports, snapshot);
}

export async function buildIntelligenceReportFromImport(
  record: ServerImportRecord,
  config: FireExitAnalyticsConfig = DEFAULT_ANALYTICS_CONFIG,
): Promise<FireExitIntelligenceReport | null> {
  const mapping = (record.field_mapping ?? {}) as FieldMapping;

  if (
    record.has_analytics &&
    record.field_mapping &&
    (record.analytics_engine_version ?? null) === ANALYTICS_ENGINE_VERSION &&
    (record.analytics_threshold_seconds ??
      DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds) ===
      config.heldOpenThresholdSeconds
  ) {
    const doors = await loadDoorProfilesForImport(record.id);
    if (doors.length > 0) {
      const events = await loadParsedEventsForImport(
        record.id,
        getEventLoadOptionsForRetention(config),
      );
      const rebuiltDoors = rebuildStoredProfilesForRetention({
        profiles: doors,
        eventsByImportId: new Map([[record.id, events]]),
        config,
      });

      if (rebuiltDoors.length > 0) {
        return buildIntelligenceReportFromDoorProfiles({
          doors: rebuiltDoors,
          config,
          mapping,
          sourceFileName: record.file_name,
          analyzedRowCount: record.row_count,
          hasDurationField: record.has_duration_field ?? false,
          analyzedAt: record.created_at,
        });
      }

      return null;
    }
  }

  const parsedEvents = await loadParsedEventsForImport(
    record.id,
    getEventLoadOptionsForRetention(config),
  ).catch((): ParsedFireExitEvent[] => []);

  if (parsedEvents.length > 0 && record.field_mapping) {
    const eventsByImportId = new Map([[record.id, parsedEvents]]);
    const importContexts = new Map([[record.id, toImportContext(record)]]);

    return runIntelligenceWithCanonicalIncidents({
      eventsByImportId,
      importContexts,
      config,
      headers: record.headers,
      sourceFileName: record.file_name,
      analyzedRowCount: record.row_count,
      hasDurationField: record.has_duration_field ?? false,
      mapping,
    });
  }

  const doors = await loadDoorProfilesForImport(record.id);

  if (doors.length > 0) {
    return buildIntelligenceReportFromDoorProfiles({
      doors,
      config,
      mapping,
      sourceFileName: record.file_name,
      analyzedRowCount: record.row_count,
      hasDurationField: record.has_duration_field ?? false,
      analyzedAt: record.created_at,
    });
  }

  if (record.analysis_snapshot) {
    const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot;
    if (snapshot.intelligence) {
      return normalizeIntelligenceReport(snapshot.intelligence);
    }
  }

  return null;
}

export async function buildImportAnalysisSnapshotFromImport(
  record: ServerImportRecord,
  config: FireExitAnalyticsConfig = DEFAULT_ANALYTICS_CONFIG,
): Promise<ImportAnalysisSnapshot | null> {
  const intelligence = await buildIntelligenceReportFromImport(record, config);

  if (!intelligence) {
    return null;
  }

  return toClientImportAnalysisSnapshot({
    mapping: intelligence.mapping,
    analyzedRowCount: record.row_count,
    intelligence,
    hasDurationField: intelligence.summary.hasDurationField,
  });
}
