import {
  getServerImportById,
  updateServerImport,
} from "@/lib/server/db/inbound-email-repository";
import {
  loadParsedEventsForImport,
  persistImportAnalytics,
} from "@/lib/server/db/import-analytics-repository";
import { processCsvImport } from "@/lib/server/imports/process-csv-import";
import { createManualImportFromCsv, reprocessImport } from "@/lib/server/imports/import-processor";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import { areRequiredFieldsMapped } from "@/lib/imports/mapping-utils";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import { toImportAnalysisSnapshot } from "@/lib/imports/import-analysis";
import type { FieldMapping, ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";
import { listImportsWithAnalytics } from "@/lib/server/db/inbound-email-repository";

export async function createManualCsvImport(input: {
  fileName: string;
  csvText: string;
  config?: FireExitAnalyticsConfig;
}): Promise<ServerImportRecord> {
  return createManualImportFromCsv(input);
}

export async function updateImportMapping(
  importId: string,
  mapping: FieldMapping,
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord> {
  const existing = await getServerImportById(importId);

  if (!existing) {
    throw new Error("Import not found.");
  }

  const parsedEvents = await loadParsedEventsForImport(importId);

  if (parsedEvents.length === 0) {
    throw new Error("No parsed events available for mapping update.");
  }

  const artifacts = runFireExitIntelligenceFromParsedEvents(
    parsedEvents,
    existing.headers,
    [],
    {
      sourceFileName: existing.file_name,
      config,
      analyzedRowCount: existing.row_count,
      hasDurationField: existing.has_duration_field ?? false,
      mapping,
    },
  );

  const snapshot = toImportAnalysisSnapshot(
    artifacts.report,
    existing.row_count,
    artifacts.parsedEvents,
    artifacts.hasDurationField,
  );

  const analytics = await persistImportAnalytics({
    importId,
    intelligence: snapshot.intelligence,
    parsedEvents: artifacts.parsedEvents,
  });

  const status = areRequiredFieldsMapped(snapshot.mapping) ? "mapped" : "ready_for_mapping";

  return updateServerImport(importId, {
    fieldMapping: snapshot.mapping,
    analysisSnapshot: null,
    status,
    processingResult: `Updated field mapping for ${existing.row_count.toLocaleString()} rows.`,
    doorCount: analytics.doorCount,
    incidentCount: analytics.incidentCount,
    complianceScoreSnapshot: analytics.complianceScoreSnapshot,
    reportingPeriodStart: analytics.reportingPeriodStart,
    reportingPeriodEnd: analytics.reportingPeriodEnd,
    hasAnalytics: true,
    hasDurationField: snapshot.hasDurationField ?? false,
  });
}

export async function saveImportAnalysisSnapshot(
  importId: string,
  snapshot: ImportAnalysisSnapshot,
  status?: ServerImportRecord["status"],
): Promise<ServerImportRecord> {
  const analytics = await persistImportAnalytics({
    importId,
    intelligence: snapshot.intelligence,
    parsedEvents: snapshot.parsedEvents ?? [],
  });

  return updateServerImport(importId, {
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
  });
}

export type RefreshImportAnalysisResult = {
  refreshed: number;
  skipped: number;
};

export async function refreshAllImportAnalysisSnapshots(
  config: FireExitAnalyticsConfig,
): Promise<RefreshImportAnalysisResult> {
  const imports = await listImportsWithAnalytics();
  let refreshed = 0;
  let skipped = 0;

  for (const record of imports) {
    try {
      await reprocessImport(record.id, config);
      refreshed += 1;
    } catch {
      skipped += 1;
    }
  }

  return { refreshed, skipped };
}

export { reprocessImport };
