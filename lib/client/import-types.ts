import type { ImportAnalysisSnapshot, ImportStatus } from "@/lib/imports/types";
import type { ServerImportListItem, ServerImportRecord } from "@/lib/server/types/inbound-email";
import type { ProcessingLogEntry } from "@/lib/server/types/import-management";
import { sourceToLabel } from "@/lib/server/types/import-management";

export type ApiImportRecord = {
  id: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  status: ImportStatus;
  uploadedAt: string;
  previewRows: [];
  analysisSnapshot?: ImportAnalysisSnapshot;
  source: ServerImportRecord["source"];
  sourceLabel: "Email" | "Manual";
  sender: string | null;
  emailSubject: string | null;
  processingResult: string | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  importedDate: string;
  processingDurationMs: number | null;
  doorCount: number;
  incidentCount: number;
  complianceScoreSnapshot: number | null;
  processingLog: ProcessingLogEntry[];
  errorCount: number;
  hasAnalytics: boolean;
  failedCsvAvailable: boolean;
};

export function mapServerImportListItem(item: ServerImportListItem): ApiImportRecord {
  return {
    id: item.id,
    fileName: item.fileName,
    rowCount: item.rowCount,
    columnCount: item.columnCount,
    headers: item.headers,
    status: item.status as ImportStatus,
    uploadedAt: item.importedDate,
    previewRows: [],
    source: item.source,
    sourceLabel: item.sourceLabel,
    sender: item.sender,
    emailSubject: item.emailSubject,
    processingResult: item.processingResult,
    reportingPeriodStart: item.reportingPeriodStart,
    reportingPeriodEnd: item.reportingPeriodEnd,
    importedDate: item.importedDate,
    processingDurationMs: item.processingDurationMs,
    doorCount: item.doorCount,
    incidentCount: item.incidentCount,
    complianceScoreSnapshot: item.complianceScoreSnapshot,
    processingLog: item.processingLog,
    errorCount: item.errorCount,
    hasAnalytics: item.hasAnalytics,
    failedCsvAvailable: item.failedCsvAvailable,
  };
}

export function mapServerImportRecord(
  record: ServerImportRecord,
  analysisSnapshot?: ImportAnalysisSnapshot,
): ApiImportRecord {
  return {
    id: record.id,
    fileName: record.file_name,
    rowCount: record.row_count,
    columnCount: record.column_count,
    headers: record.headers,
    status: record.status as ImportStatus,
    uploadedAt: record.created_at,
    previewRows: [],
    analysisSnapshot,
    source: record.source,
    sourceLabel: sourceToLabel(record.source),
    sender: record.sender ?? record.inbound_emails?.from_address ?? null,
    emailSubject: record.inbound_emails?.subject ?? null,
    processingResult: record.processing_result,
    reportingPeriodStart: record.reporting_period_start,
    reportingPeriodEnd: record.reporting_period_end,
    importedDate: record.created_at,
    processingDurationMs: record.processing_duration_ms,
    doorCount: record.door_count,
    incidentCount: record.incident_count,
    complianceScoreSnapshot: record.compliance_score_snapshot,
    processingLog: record.processing_log ?? [],
    errorCount: record.error_count ?? 0,
    hasAnalytics: record.has_analytics ?? false,
    failedCsvAvailable: Boolean(record.failed_csv_path),
  };
}
