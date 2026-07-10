import { randomUUID } from "node:crypto";
import {
  createServerImport,
  downloadCsvFromStorage,
  getServerImportById,
  listImportsWithAnalysisSnapshot,
  updateServerImport,
  uploadCsvToStorage,
} from "@/lib/server/db/inbound-email-repository";
import { getSupabaseStorageBucket } from "@/lib/server/env";
import { sanitizeAttachmentFileName } from "@/lib/server/inbound-email/attachment-validation";
import { processCsvImport } from "@/lib/server/imports/process-csv-import";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import { areRequiredFieldsMapped } from "@/lib/imports/mapping-utils";
import {
  buildImportAnalysis,
  rebuildImportAnalysisWithCurrentConfig,
  snapshotHasReplayEvents,
} from "@/lib/imports/import-analysis";
import { parseCsvText } from "@/lib/imports/parse-csv-text";
import type { FieldMapping, ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";

export async function createManualCsvImport(input: {
  fileName: string;
  csvText: string;
  config?: FireExitAnalyticsConfig;
}): Promise<ServerImportRecord> {
  const bucket = getSupabaseStorageBucket();
  const safeFileName = sanitizeAttachmentFileName(input.fileName);
  const importId = randomUUID();
  const storagePath = `manual/${importId}/${safeFileName}`;

  const result = processCsvImport({
    fileName: safeFileName,
    csvText: input.csvText,
    source: "manual_upload",
    config: input.config,
    requireCompleteMapping: false,
  });

  if (!result.ok) {
    throw new Error(result.reason);
  }

  await uploadCsvToStorage(storagePath, input.csvText, bucket);

  return createServerImport({
    source: "manual_upload",
    fileName: safeFileName,
    originalFilePath: storagePath,
    rowCount: result.rowCount,
    columnCount: result.columnCount,
    headers: result.headers,
    fieldMapping: result.analysisSnapshot.mapping,
    analysisSnapshot: result.analysisSnapshot,
    status: result.status,
    processingResult: result.processingResult,
  });
}

export async function updateImportMapping(
  importId: string,
  mapping: FieldMapping,
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord> {
  const bucket = getSupabaseStorageBucket();
  const existing = await getServerImportById(importId);

  if (!existing) {
    throw new Error("Import not found.");
  }

  if (!existing.original_file_path) {
    throw new Error("Import CSV file path not found.");
  }

  const csvText = await downloadCsvFromStorage(
    existing.original_file_path,
    bucket,
  );
  const parsed = parseCsvText(csvText);
  const snapshot = buildImportAnalysis(
    parsed.headers,
    parsed.rows,
    existing.file_name,
    mapping,
    config,
  );

  const status = areRequiredFieldsMapped(mapping) ? "mapped" : "ready_for_mapping";

  return updateServerImport(importId, {
    fieldMapping: snapshot.mapping,
    analysisSnapshot: snapshot,
    status,
    processingResult: `Updated field mapping for ${parsed.rows.length.toLocaleString()} rows.`,
  });
}

export async function saveImportAnalysisSnapshot(
  importId: string,
  snapshot: ImportAnalysisSnapshot,
  status?: ServerImportRecord["status"],
): Promise<ServerImportRecord> {
  return updateServerImport(importId, {
    fieldMapping: snapshot.mapping,
    analysisSnapshot: snapshot,
    status,
  });
}

export type RefreshImportAnalysisResult = {
  refreshed: number;
  skipped: number;
};

export async function refreshAllImportAnalysisSnapshots(
  config: FireExitAnalyticsConfig,
): Promise<RefreshImportAnalysisResult> {
  const imports = await listImportsWithAnalysisSnapshot();
  let refreshed = 0;
  let skipped = 0;

  for (const record of imports) {
    const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot | null;
    if (!snapshot) {
      skipped += 1;
      continue;
    }

    if (snapshotHasReplayEvents(snapshot)) {
      const rebuilt = rebuildImportAnalysisWithCurrentConfig(
        snapshot,
        record.headers,
        record.file_name,
        config,
      );

      if (!rebuilt) {
        skipped += 1;
        continue;
      }

      await updateServerImport(record.id, {
        analysisSnapshot: rebuilt,
        fieldMapping: rebuilt.mapping,
        status: record.status,
      });
      refreshed += 1;
      continue;
    }

    if (!record.original_file_path) {
      skipped += 1;
      continue;
    }

    try {
      const bucket = getSupabaseStorageBucket();
      const csvText = await downloadCsvFromStorage(
        record.original_file_path,
        bucket,
      );
      const parsed = parseCsvText(csvText);
      const rebuilt = buildImportAnalysis(
        parsed.headers,
        parsed.rows,
        record.file_name,
        snapshot.mapping,
        config,
      );

      await updateServerImport(record.id, {
        analysisSnapshot: rebuilt,
        fieldMapping: rebuilt.mapping,
        status: record.status,
      });
      refreshed += 1;
    } catch {
      skipped += 1;
    }
  }

  return { refreshed, skipped };
}
