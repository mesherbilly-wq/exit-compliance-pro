export type ProcessingLogLevel = "info" | "warn" | "error";

export type ProcessingLogEntry = {
  timestamp: string;
  level: ProcessingLogLevel;
  message: string;
};

export type ImportSourceLabel = "Email" | "Manual";

export type ImportManagementRecord = {
  id: string;
  source: "manual_upload" | "inbound_email";
  sourceLabel: ImportSourceLabel;
  status: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  importedDate: string;
  processingDurationMs: number | null;
  fileName: string;
  sender: string | null;
  rowCount: number;
  doorCount: number;
  incidentCount: number;
  complianceScoreSnapshot: number | null;
  processingLog: ProcessingLogEntry[];
  errorCount: number;
  hasAnalytics: boolean;
  failedCsvAvailable: boolean;
  processingResult: string | null;
  emailSubject: string | null;
  columnCount: number;
  headers: string[];
};

export type ImportIncidentRow = {
  id: string;
  import_id: string;
  door: string;
  start_timestamp: number;
  end_timestamp: number;
  start_time_label: string;
  end_time_label: string;
  duration_seconds: number;
  threshold_seconds: number;
  time_beyond_threshold_seconds: number;
  risk_rating: string;
  duration_bucket: string;
  day_started: string;
  hour_started: number;
  is_explicit_alarm: boolean;
  event_type: string;
  classification?: string | null;
  trace_data?: Record<string, unknown> | null;
  analytics_engine_version?: string | null;
};

export type ImportHourlyStatisticRow = {
  import_id: string;
  door: string;
  hour_label: string;
  incident_count: number;
  exposure_seconds: number;
};

export type ImportDailyStatisticRow = {
  import_id: string;
  door: string;
  day_label: string;
  incident_count: number;
  exposure_seconds: number;
};

export type ImportDoorComplianceRow = {
  import_id: string;
  door: string;
  compliance_score: number;
  compliance_rating: string;
  total_incidents: number;
  total_fire_exit_events: number;
  total_exposure_seconds: number;
  status: string;
  profile_data: Record<string, unknown>;
};

export type ImportParsedEventRow = {
  import_id: string;
  door: string;
  event_time: string;
  event_type: string;
  event_timestamp: number;
  csv_duration_seconds: number | null;
  source_row_number?: number | null;
  source_sequence?: number | null;
  source_event_id?: string | null;
  source_system?: string | null;
  site?: string | null;
};

export function sourceToLabel(
  source: "manual_upload" | "inbound_email",
): ImportSourceLabel {
  return source === "inbound_email" ? "Email" : "Manual";
}

export function createProcessingLogEntry(
  level: ProcessingLogLevel,
  message: string,
): ProcessingLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
}

export class ImportProcessingLogger {
  private entries: ProcessingLogEntry[] = [];

  info(message: string): void {
    this.entries.push(createProcessingLogEntry("info", message));
  }

  warn(message: string): void {
    this.entries.push(createProcessingLogEntry("warn", message));
  }

  error(message: string): void {
    this.entries.push(createProcessingLogEntry("error", message));
  }

  getEntries(): ProcessingLogEntry[] {
    return [...this.entries];
  }

  getErrorCount(): number {
    return this.entries.filter((entry) => entry.level === "error").length;
  }
}
