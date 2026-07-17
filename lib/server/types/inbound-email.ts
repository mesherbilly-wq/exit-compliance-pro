import type { ProcessingLogEntry } from "@/lib/server/types/import-management";

export type InboundEmailStatus = "processing" | "processed" | "rejected" | "failed";

export type ServerImportSource = "manual_upload" | "inbound_email";

export type ServerImportStatus =
  | "processing"
  | "processed"
  | "rejected"
  | "failed"
  | "ready_for_mapping"
  | "mapped";

export type InboundEmailRecord = {
  id: string;
  provider_email_id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  received_at: string | null;
  status: InboundEmailStatus;
  failure_reason: string | null;
  created_at: string;
};

export type ServerImportRecord = {
  id: string;
  source: ServerImportSource;
  file_name: string;
  original_file_path: string | null;
  row_count: number;
  column_count: number;
  headers: string[];
  field_mapping: Record<string, string> | null;
  analysis_snapshot: unknown | null;
  status: ServerImportStatus;
  inbound_email_id: string | null;
  processing_result: string | null;
  created_at: string;
  reporting_period_start: string | null;
  reporting_period_end: string | null;
  processing_duration_ms: number | null;
  sender: string | null;
  door_count: number;
  incident_count: number;
  compliance_score_snapshot: number | null;
  processing_log: ProcessingLogEntry[];
  error_count: number;
  failed_csv_path: string | null;
  failed_csv_retention_until: string | null;
  has_analytics: boolean;
  has_duration_field: boolean;
  analytics_engine_version?: string | null;
  analytics_threshold_seconds?: number | null;
  inbound_emails?: {
    from_address: string;
    subject: string | null;
    received_at: string | null;
    status: InboundEmailStatus;
    failure_reason: string | null;
  } | null;
};

export type ServerImportListItem = {
  id: string;
  source: ServerImportSource;
  sourceLabel: "Email" | "Manual";
  fileName: string;
  sender: string | null;
  emailSubject: string | null;
  receivedAt: string | null;
  status: ServerImportStatus;
  rowCount: number;
  columnCount: number;
  headers: string[];
  processingResult: string | null;
  createdAt: string;
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
