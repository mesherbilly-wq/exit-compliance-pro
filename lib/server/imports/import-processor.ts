import { randomUUID } from "node:crypto";
import {
  createServerImport,
  deleteCsvFromStorage,
  downloadCsvFromStorage,
  getServerImportById,
  updateServerImport,
  uploadCsvToStorage,
} from "@/lib/server/db/inbound-email-repository";
import {
  appendProcessingLog,
  persistImportAnalytics,
} from "@/lib/server/db/import-analytics-repository";
import { getFailedCsvRetentionDays, getSupabaseStorageBucket } from "@/lib/server/env";
import { sanitizeAttachmentFileName } from "@/lib/server/inbound-email/attachment-validation";
import { processCsvImport } from "@/lib/server/imports/process-csv-import";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import { buildCanonicalIncidentsByDoor } from "@/lib/analytics/canonical-incident-engine";
import { toImportAnalysisSnapshot } from "@/lib/imports/import-analysis";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import {
  ImportProcessingLogger,
  type ProcessingLogEntry,
} from "@/lib/server/types/import-management";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";
import type { FieldMapping } from "@/lib/imports/types";
import { areRequiredFieldsMapped } from "@/lib/imports/mapping-utils";
import { loadParsedEventsForImport } from "@/lib/server/db/import-analytics-repository";

function failedCsvRetentionUntil(): string {
  const days = getFailedCsvRetentionDays();
  const until = new Date();
  until.setDate(until.getDate() + days);
  return until.toISOString();
}

async function finalizeSuccessfulImport(
  importId: string,
  record: ServerImportRecord,
  logger: ImportProcessingLogger,
  startedAt: number,
): Promise<ServerImportRecord> {
  const processingDurationMs = Date.now() - startedAt;
  const logEntries = logger.getEntries();

  const updated = await updateServerImport(importId, {
    status: record.status,
    processingResult: record.processing_result,
    fieldMapping: record.field_mapping,
    analysisSnapshot: null,
    rowCount: record.row_count,
    columnCount: record.column_count,
    headers: record.headers,
    processingDurationMs,
    processingLog: logEntries,
    errorCount: logger.getErrorCount(),
    hasAnalytics: true,
    originalFilePath: null,
    failedCsvPath: null,
    failedCsvRetentionUntil: null,
    doorCount: record.door_count,
    incidentCount: record.incident_count,
    complianceScoreSnapshot: record.compliance_score_snapshot,
    reportingPeriodStart: record.reporting_period_start,
    reportingPeriodEnd: record.reporting_period_end,
    hasDurationField: record.has_duration_field,
    analyticsEngineVersion: record.analytics_engine_version ?? null,
    analyticsThresholdSeconds: record.analytics_threshold_seconds ?? null,
  });

  logger.info(`Import finalized in ${processingDurationMs}ms.`);
  await appendProcessingLog(importId, [
    createProcessingLogEntry("info", `Import finalized in ${processingDurationMs}ms.`),
  ]);

  return updated;
}

function createProcessingLogEntry(
  level: ProcessingLogEntry["level"],
  message: string,
): ProcessingLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
}

export type CompleteImportProcessingInput = {
  importId: string;
  fileName: string;
  csvText: string;
  source: "manual_upload" | "inbound_email";
  sender?: string | null;
  inboundEmailId?: string | null;
  config?: FireExitAnalyticsConfig;
  requireCompleteMapping?: boolean;
};

export async function completeImportProcessing(
  input: CompleteImportProcessingInput,
): Promise<ServerImportRecord> {
  const startedAt = Date.now();
  const logger = new ImportProcessingLogger();
  const bucket = getSupabaseStorageBucket();
  const safeFileName = sanitizeAttachmentFileName(input.fileName);
  const importId = input.importId;

  logger.info(`Starting import processing for "${safeFileName}".`);

  const processingRecord = await createServerImport({
    id: importId,
    source: input.source,
    fileName: safeFileName,
    sender: input.sender ?? null,
    status: "processing",
    inboundEmailId: input.inboundEmailId ?? null,
    processingLog: logger.getEntries(),
  });

  const result = processCsvImport({
    fileName: safeFileName,
    csvText: input.csvText,
    source: input.source,
    config: input.config,
    requireCompleteMapping: input.requireCompleteMapping,
  });

  if (!result.ok) {
    logger.error(result.reason);
    const failedPath = `${input.source === "inbound_email" ? "failed/inbound" : "failed/manual"}/${importId}/${safeFileName}`;

    await uploadCsvToStorage(failedPath, input.csvText, bucket);
    logger.info(`Failed CSV stored temporarily at ${failedPath}.`);

    return updateServerImport(importId, {
      status: result.status,
      processingResult: result.reason,
      processingDurationMs: Date.now() - startedAt,
      processingLog: logger.getEntries(),
      errorCount: logger.getErrorCount(),
      failedCsvPath: failedPath,
      failedCsvRetentionUntil: failedCsvRetentionUntil(),
      hasAnalytics: false,
    });
  }

  logger.info(result.processingResult);

  const analytics = await persistImportAnalytics({
    importId,
    intelligence: result.analysisSnapshot.intelligence,
    parsedEvents: result.analysisSnapshot.parsedEvents ?? [],
    analyticsThresholdSeconds: input.config?.heldOpenThresholdSeconds,
  });

  logger.info(
    `Persisted ${analytics.incidentCount} incidents across ${analytics.doorCount} doors.`,
  );

  const interimRecord: ServerImportRecord = {
    ...processingRecord,
    row_count: result.rowCount,
    column_count: result.columnCount,
    headers: result.headers,
    field_mapping: result.analysisSnapshot.mapping,
    analysis_snapshot: result.analysisSnapshot,
    status: result.status,
    processing_result: result.processingResult,
    door_count: analytics.doorCount,
    incident_count: analytics.incidentCount,
    compliance_score_snapshot: analytics.complianceScoreSnapshot,
    reporting_period_start: analytics.reportingPeriodStart,
    reporting_period_end: analytics.reportingPeriodEnd,
    has_duration_field: result.analysisSnapshot.hasDurationField ?? false,
    has_analytics: true,
    analytics_engine_version: analytics.analyticsEngineVersion,
    analytics_threshold_seconds: analytics.analyticsThresholdSeconds,
  };

  return finalizeSuccessfulImport(importId, interimRecord, logger, startedAt);
}

export async function createManualImportFromCsv(input: {
  fileName: string;
  csvText: string;
  config?: FireExitAnalyticsConfig;
}): Promise<ServerImportRecord> {
  return completeImportProcessing({
    importId: randomUUID(),
    fileName: input.fileName,
    csvText: input.csvText,
    source: "manual_upload",
    requireCompleteMapping: false,
    config: input.config,
  });
}

export async function reprocessImport(
  importId: string,
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord> {
  const startedAt = Date.now();
  const logger = new ImportProcessingLogger();
  const bucket = getSupabaseStorageBucket();
  const existing = await getServerImportById(importId);

  if (!existing) {
    throw new Error("Import not found.");
  }

  logger.info(`Reprocessing import "${existing.file_name}".`);

  await updateServerImport(importId, {
    status: "processing",
    processingLog: [...(existing.processing_log ?? []), ...logger.getEntries()],
  });

  let csvText: string | null = null;
  let parsedEvents = await loadParsedEventsForImport(importId).catch(() => []);

  if (parsedEvents.length === 0 && existing.failed_csv_path) {
    csvText = await downloadCsvFromStorage(existing.failed_csv_path, bucket);
    logger.info("Loaded failed CSV from temporary storage for reprocessing.");
  }

  if (parsedEvents.length === 0 && existing.original_file_path) {
    csvText = await downloadCsvFromStorage(existing.original_file_path, bucket);
    logger.info("Loaded legacy CSV from storage for reprocessing.");
  }

  let analysisSnapshot;

  if (csvText) {
    const result = processCsvImport({
      fileName: existing.file_name,
      csvText,
      source: existing.source,
      config,
      requireCompleteMapping: false,
    });

    if (!result.ok) {
      logger.error(result.reason);
      return updateServerImport(importId, {
        status: result.status,
        processingResult: result.reason,
        processingDurationMs: Date.now() - startedAt,
        processingLog: [...(existing.processing_log ?? []), ...logger.getEntries()],
        errorCount: logger.getErrorCount(),
      });
    }

    analysisSnapshot = result.analysisSnapshot;
    parsedEvents = result.analysisSnapshot.parsedEvents ?? [];
  } else if (parsedEvents.length > 0) {
    const mapping = (existing.field_mapping ?? {}) as FieldMapping;
    const eventsByImportId = new Map([[importId, parsedEvents]]);
    const importContexts = new Map([
      [
        importId,
        {
          importId,
          reportingPeriodStart: existing.reporting_period_start,
          reportingPeriodEnd: existing.reporting_period_end,
          createdAt: existing.created_at,
        },
      ],
    ]);
    const canonical = buildCanonicalIncidentsByDoor({
      eventsByImportId,
      importContexts,
      config: config ?? { heldOpenThresholdSeconds: 30 },
    });
    const artifacts = runFireExitIntelligenceFromParsedEvents(
      canonical.dedupedEvents,
      existing.headers,
      [],
      {
        sourceFileName: existing.file_name,
        config,
        analyzedRowCount: existing.row_count,
        hasDurationField: existing.has_duration_field ?? false,
        mapping,
        incidentsByDoor: canonical.incidentsByDoor,
      },
    );

    analysisSnapshot = toImportAnalysisSnapshot(
      artifacts.report,
      existing.row_count,
      artifacts.parsedEvents,
      artifacts.hasDurationField,
    );
    parsedEvents = artifacts.parsedEvents;
    logger.info("Rebuilt analytics from stored parsed events.");
  } else {
    throw new Error("No CSV or parsed events available for reprocessing.");
  }

  const analytics = await persistImportAnalytics({
    importId,
    intelligence: analysisSnapshot.intelligence,
    parsedEvents,
    analyticsThresholdSeconds: config?.heldOpenThresholdSeconds,
  });

  logger.info(
    `Reprocessed ${analytics.incidentCount} incidents across ${analytics.doorCount} doors.`,
  );

  const status = areRequiredFieldsMapped(analysisSnapshot.mapping)
    ? "processed"
    : "ready_for_mapping";

  if (existing.failed_csv_path) {
    await deleteCsvFromStorage(existing.failed_csv_path, bucket);
    logger.info("Removed temporary failed CSV after successful reprocess.");
  }

  if (existing.original_file_path) {
    await deleteCsvFromStorage(existing.original_file_path, bucket);
    logger.info("Removed legacy CSV after successful reprocess.");
  }

  const interimRecord: ServerImportRecord = {
    ...existing,
    field_mapping: analysisSnapshot.mapping,
    analysis_snapshot: analysisSnapshot,
    status,
    processing_result: `Reprocessed ${existing.row_count.toLocaleString()} rows through fire exit analytics.`,
    door_count: analytics.doorCount,
    incident_count: analytics.incidentCount,
    compliance_score_snapshot: analytics.complianceScoreSnapshot,
    reporting_period_start: analytics.reportingPeriodStart,
    reporting_period_end: analytics.reportingPeriodEnd,
    has_duration_field: analysisSnapshot.hasDurationField ?? false,
    has_analytics: true,
    analytics_engine_version: analytics.analyticsEngineVersion,
    analytics_threshold_seconds: analytics.analyticsThresholdSeconds,
  };

  return finalizeSuccessfulImport(importId, interimRecord, logger, startedAt);
}

export async function cleanupExpiredFailedCsvs(): Promise<number> {
  const supabase = (await import("@/lib/server/supabase/admin")).getSupabaseAdmin();
  const bucket = getSupabaseStorageBucket();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("imports")
    .select("id, failed_csv_path")
    .not("failed_csv_path", "is", null)
    .lt("failed_csv_retention_until", now);

  if (error) {
    throw new Error(`Failed to list expired failed CSVs: ${error.message}`);
  }

  let removed = 0;

  for (const row of (data as { id: string; failed_csv_path: string }[]) ?? []) {
    await deleteCsvFromStorage(row.failed_csv_path, bucket);
    await updateServerImport(row.id, {
      failedCsvPath: null,
      failedCsvRetentionUntil: null,
    });
    removed += 1;
  }

  return removed;
}
