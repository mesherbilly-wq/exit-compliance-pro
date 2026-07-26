import { ANALYTICS_ENGINE_VERSION } from "@/lib/analytics/analytics-engine-version";
import {
  buildCanonicalIncidentsByDoor,
  type ImportContext,
} from "@/lib/analytics/canonical-incident-engine";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import { toImportAnalysisSnapshot } from "@/lib/imports/import-analysis";
import type { FieldMapping } from "@/lib/imports/types";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import {
  loadParsedEventsGroupedByImports,
  persistImportAnalytics,
} from "@/lib/server/db/import-analytics-repository";
import {
  listImportsWithAnalytics,
  updateServerImport,
} from "@/lib/server/db/inbound-email-repository";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import { areRequiredFieldsMapped } from "@/lib/imports/mapping-utils";
import { invalidateAccumulatedAnalyticsCache } from "@/lib/server/imports/accumulated-analytics-cache";

export type RebuildCanonicalAnalyticsResult = {
  refreshed: number;
  skipped: number;
};

function toImportContext(record: ServerImportRecord): ImportContext {
  return {
    importId: record.id,
    reportingPeriodStart: record.reporting_period_start,
    reportingPeriodEnd: record.reporting_period_end,
    createdAt: record.created_at,
  };
}

export function attributeIncidentToImportId(
  incident: ComplianceIncident,
): string | null {
  const trace = incident.trace;
  if (trace?.closeSourceImportId) {
    return trace.closeSourceImportId;
  }

  if (trace?.openSourceImportId) {
    return trace.openSourceImportId;
  }

  return null;
}

export function filterIncidentsByDoorForImport(
  incidentsByDoor: Map<string, ComplianceIncident[]>,
  importId: string,
): Map<string, ComplianceIncident[]> {
  const filtered = new Map<string, ComplianceIncident[]>();

  for (const [door, incidents] of incidentsByDoor) {
    const owned = incidents.filter(
      (incident) => attributeIncidentToImportId(incident) === importId,
    );

    if (owned.length > 0) {
      filtered.set(door, owned);
    }
  }

  return filtered;
}

export function filterImportEvents(
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
  importId: string,
): ParsedFireExitEvent[] {
  return eventsByImportId.get(importId) ?? [];
}

export async function rebuildImportsWithCanonicalEngine(
  config: FireExitAnalyticsConfig,
  targetImportIds?: string[],
): Promise<RebuildCanonicalAnalyticsResult> {
  const imports = await listImportsWithAnalytics();

  if (imports.length === 0) {
    return { refreshed: 0, skipped: 0 };
  }

  const importIds = imports.map((record) => record.id);
  const importContexts = new Map(
    imports.map((record) => [record.id, toImportContext(record)]),
  );
  const { eventsByImportId } = await loadParsedEventsGroupedByImports(importIds);

  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId,
    importContexts,
    config,
    includeTrace: true,
  });

  const targets = targetImportIds?.length
    ? imports.filter((record) => targetImportIds.includes(record.id))
    : imports;

  let refreshed = 0;
  let skipped = 0;

  for (const record of targets) {
    try {
      const importEvents = filterImportEvents(eventsByImportId, record.id);
      const mapping = (record.field_mapping ?? {}) as FieldMapping;

      if (importEvents.length === 0 || !record.field_mapping) {
        skipped += 1;
        continue;
      }

      const ownedIncidentsByDoor = filterIncidentsByDoorForImport(
        canonical.incidentsByDoor,
        record.id,
      );

      const artifacts = runFireExitIntelligenceFromParsedEvents(
        importEvents,
        record.headers,
        [],
        {
          sourceFileName: record.file_name,
          config,
          analyzedRowCount: record.row_count,
          hasDurationField: record.has_duration_field ?? false,
          mapping,
          incidentsByDoor: ownedIncidentsByDoor,
        },
      );

      const snapshot = toImportAnalysisSnapshot(
        artifacts.report,
        record.row_count,
        importEvents,
        artifacts.hasDurationField,
      );

      const analytics = await persistImportAnalytics({
        importId: record.id,
        intelligence: snapshot.intelligence,
        parsedEvents: importEvents,
        analyticsEngineVersion: ANALYTICS_ENGINE_VERSION,
        analyticsThresholdSeconds: config.heldOpenThresholdSeconds,
      });

      const status = areRequiredFieldsMapped(snapshot.mapping)
        ? "processed"
        : "ready_for_mapping";

      await updateServerImport(record.id, {
        fieldMapping: snapshot.mapping,
        analysisSnapshot: null,
        status,
        doorCount: analytics.doorCount,
        incidentCount: analytics.incidentCount,
        complianceScoreSnapshot: analytics.complianceScoreSnapshot,
        reportingPeriodStart: analytics.reportingPeriodStart,
        reportingPeriodEnd: analytics.reportingPeriodEnd,
        hasAnalytics: true,
        hasDurationField: snapshot.hasDurationField ?? false,
        analyticsEngineVersion: analytics.analyticsEngineVersion,
        analyticsThresholdSeconds: analytics.analyticsThresholdSeconds,
      });

      refreshed += 1;
    } catch {
      skipped += 1;
    }
  }

  invalidateAccumulatedAnalyticsCache();

  return { refreshed, skipped };
}
