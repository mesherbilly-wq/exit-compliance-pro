import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";
import { buildImportAnalysis } from "@/lib/imports/import-analysis";
import { parseCsvText } from "@/lib/imports/parse-csv-text";
import { areRequiredFieldsMapped } from "@/lib/imports/mapping-utils";
import type { ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { ServerImportSource, ServerImportStatus } from "@/lib/server/types/inbound-email";

export type ProcessCsvImportInput = {
  fileName: string;
  csvText: string;
  source: ServerImportSource;
  config?: FireExitAnalyticsConfig;
  requireCompleteMapping?: boolean;
};

export type ProcessCsvImportSuccess = {
  ok: true;
  headers: string[];
  rowCount: number;
  columnCount: number;
  analysisSnapshot: ImportAnalysisSnapshot;
  status: ServerImportStatus;
  processingResult: string;
};

export type ProcessCsvImportFailure = {
  ok: false;
  reason: string;
  status: Extract<ServerImportStatus, "rejected" | "failed">;
};

export type ProcessCsvImportResult =
  | ProcessCsvImportSuccess
  | ProcessCsvImportFailure;

export function processCsvImport(
  input: ProcessCsvImportInput,
): ProcessCsvImportResult {
  const config = input.config ?? DEFAULT_ANALYTICS_CONFIG;

  let parsed;
  try {
    parsed = parseCsvText(input.csvText);
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : "CSV parsing failure.",
      status: "failed",
    };
  }

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      reason: "CSV file contains no data rows after parsing.",
      status: "rejected",
    };
  }

  let analysisSnapshot: ImportAnalysisSnapshot;
  try {
    analysisSnapshot = buildImportAnalysis(
      parsed.headers,
      parsed.rows,
      input.fileName,
      null,
      config,
    );
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "Analytics processing failure.",
      status: "failed",
    };
  }

  const mappingComplete = areRequiredFieldsMapped(analysisSnapshot.mapping);
  const requireCompleteMapping = input.requireCompleteMapping ?? true;

  if (requireCompleteMapping && !mappingComplete) {
    return {
      ok: false,
      reason:
        "Required field mapping could not be resolved automatically for this CSV.",
      status: "failed",
    };
  }

  const status: ServerImportStatus = mappingComplete
    ? "processed"
    : "ready_for_mapping";

  return {
    ok: true,
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    analysisSnapshot,
    status,
    processingResult: mappingComplete
      ? `Processed ${parsed.rows.length.toLocaleString()} rows through fire exit analytics.`
      : `Uploaded ${parsed.rows.length.toLocaleString()} rows. Field mapping required.`,
  };
}
