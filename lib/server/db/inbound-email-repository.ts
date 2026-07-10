import { getSupabaseAdmin } from "@/lib/server/supabase/admin";
import type {
  InboundEmailRecord,
  InboundEmailStatus,
  ServerImportListItem,
  ServerImportRecord,
  ServerImportStatus,
} from "@/lib/server/types/inbound-email";
import type { ProcessingLogEntry } from "@/lib/server/types/import-management";
import { sourceToLabel } from "@/lib/server/types/import-management";

function mapImportListItem(row: ServerImportRecord): ServerImportListItem {
  const sender = row.sender ?? row.inbound_emails?.from_address ?? null;

  return {
    id: row.id,
    source: row.source,
    sourceLabel: sourceToLabel(row.source),
    fileName: row.file_name,
    sender,
    emailSubject: row.inbound_emails?.subject ?? null,
    receivedAt: row.inbound_emails?.received_at ?? row.created_at,
    status: row.status,
    rowCount: row.row_count,
    columnCount: row.column_count,
    headers: row.headers,
    processingResult: row.processing_result,
    createdAt: row.created_at,
    reportingPeriodStart: row.reporting_period_start,
    reportingPeriodEnd: row.reporting_period_end,
    importedDate: row.created_at,
    processingDurationMs: row.processing_duration_ms,
    doorCount: row.door_count,
    incidentCount: row.incident_count,
    complianceScoreSnapshot:
      row.compliance_score_snapshot !== null &&
      row.compliance_score_snapshot !== undefined
        ? Number(row.compliance_score_snapshot)
        : null,
    processingLog: row.processing_log ?? [],
    errorCount: row.error_count ?? 0,
    hasAnalytics: row.has_analytics ?? false,
    failedCsvAvailable: Boolean(row.failed_csv_path),
  };
}

function mapImportRecord(row: Record<string, unknown>): ServerImportRecord {
  return {
    id: row.id as string,
    source: row.source as ServerImportRecord["source"],
    file_name: row.file_name as string,
    original_file_path: (row.original_file_path as string | null) ?? null,
    row_count: (row.row_count as number) ?? 0,
    column_count: (row.column_count as number) ?? 0,
    headers: (row.headers as string[]) ?? [],
    field_mapping: (row.field_mapping as Record<string, string> | null) ?? null,
    analysis_snapshot: row.analysis_snapshot ?? null,
    status: row.status as ServerImportStatus,
    inbound_email_id: (row.inbound_email_id as string | null) ?? null,
    processing_result: (row.processing_result as string | null) ?? null,
    created_at: row.created_at as string,
    reporting_period_start: (row.reporting_period_start as string | null) ?? null,
    reporting_period_end: (row.reporting_period_end as string | null) ?? null,
    processing_duration_ms: (row.processing_duration_ms as number | null) ?? null,
    sender: (row.sender as string | null) ?? null,
    door_count: (row.door_count as number) ?? 0,
    incident_count: (row.incident_count as number) ?? 0,
    compliance_score_snapshot:
      row.compliance_score_snapshot !== null &&
      row.compliance_score_snapshot !== undefined
        ? Number(row.compliance_score_snapshot)
        : null,
    processing_log: (row.processing_log as ProcessingLogEntry[]) ?? [],
    error_count: (row.error_count as number) ?? 0,
    failed_csv_path: (row.failed_csv_path as string | null) ?? null,
    failed_csv_retention_until:
      (row.failed_csv_retention_until as string | null) ?? null,
    has_analytics: (row.has_analytics as boolean) ?? false,
    has_duration_field: (row.has_duration_field as boolean) ?? false,
    inbound_emails: row.inbound_emails as ServerImportRecord["inbound_emails"],
  };
}

export async function findInboundEmailByProviderId(
  providerEmailId: string,
): Promise<InboundEmailRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inbound_emails")
    .select("*")
    .eq("provider_email_id", providerEmailId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up inbound email: ${error.message}`);
  }

  return (data as InboundEmailRecord | null) ?? null;
}

export async function createInboundEmail(input: {
  providerEmailId: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  receivedAt: string | null;
  status: InboundEmailStatus;
  failureReason?: string | null;
}): Promise<InboundEmailRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inbound_emails")
    .insert({
      provider_email_id: input.providerEmailId,
      from_address: input.fromAddress,
      to_address: input.toAddress,
      subject: input.subject,
      received_at: input.receivedAt,
      status: input.status,
      failure_reason: input.failureReason ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create inbound email record: ${error.message}`);
  }

  return data as InboundEmailRecord;
}

export async function updateInboundEmailStatus(
  id: string,
  status: InboundEmailStatus,
  failureReason?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("inbound_emails")
    .update({
      status,
      failure_reason: failureReason ?? null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update inbound email status: ${error.message}`);
  }
}

export async function createServerImport(input: {
  id?: string;
  source: "manual_upload" | "inbound_email";
  fileName: string;
  originalFilePath?: string | null;
  rowCount?: number;
  columnCount?: number;
  headers?: string[];
  fieldMapping?: Record<string, string> | null;
  analysisSnapshot?: unknown | null;
  status: ServerImportStatus;
  inboundEmailId?: string | null;
  processingResult?: string | null;
  sender?: string | null;
  processingLog?: ProcessingLogEntry[];
}): Promise<ServerImportRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      source: input.source,
      file_name: input.fileName,
      original_file_path: input.originalFilePath ?? null,
      row_count: input.rowCount ?? 0,
      column_count: input.columnCount ?? 0,
      headers: input.headers ?? [],
      field_mapping: input.fieldMapping ?? null,
      analysis_snapshot: input.analysisSnapshot ?? null,
      status: input.status,
      inbound_email_id: input.inboundEmailId ?? null,
      processing_result: input.processingResult ?? null,
      sender: input.sender ?? null,
      processing_log: input.processingLog ?? [],
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create import record: ${error.message}`);
  }

  return mapImportRecord(data as Record<string, unknown>);
}

export async function listServerImports(): Promise<ServerImportListItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select(
      `
      *,
      inbound_emails (
        from_address,
        subject,
        received_at,
        status,
        failure_reason
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to list server imports: ${error.message}`);
  }

  return ((data as Record<string, unknown>[]) ?? []).map((row) =>
    mapImportListItem(mapImportRecord(row)),
  );
}

export async function getServerImportById(
  importId: string,
): Promise<ServerImportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select(
      `
      *,
      inbound_emails (
        from_address,
        subject,
        received_at,
        status,
        failure_reason
      )
    `,
    )
    .eq("id", importId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load import: ${error.message}`);
  }

  return data ? mapImportRecord(data as Record<string, unknown>) : null;
}

export async function deleteServerImport(
  importId: string,
  bucket: string,
): Promise<void> {
  const importRecord = await getServerImportById(importId);

  if (!importRecord) {
    throw new Error("Import not found.");
  }

  const supabase = getSupabaseAdmin();
  const paths = [
    importRecord.original_file_path,
    importRecord.failed_csv_path,
  ].filter((path): path is string => Boolean(path));

  for (const path of paths) {
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (storageError) {
      console.warn(
        JSON.stringify({
          scope: "imports-api",
          event: "storage-delete-warning",
          importId,
          path,
          message: storageError.message,
        }),
      );
    }
  }

  const { error } = await supabase.from("imports").delete().eq("id", importId);

  if (error) {
    throw new Error(`Failed to delete import: ${error.message}`);
  }
}

export async function getInboundEmailSummary(): Promise<{
  lastReceived: InboundEmailRecord | null;
  lastSuccessfulImport: ServerImportRecord | null;
  lastFailure: InboundEmailRecord | null;
}> {
  const supabase = getSupabaseAdmin();

  const [lastReceivedResult, lastSuccessImportResult, lastFailureResult] =
    await Promise.all([
      supabase
        .from("inbound_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("imports")
        .select("*")
        .eq("source", "inbound_email")
        .eq("status", "processed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("inbound_emails")
        .select("*")
        .in("status", ["failed", "rejected"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (lastReceivedResult.error) {
    throw new Error(lastReceivedResult.error.message);
  }
  if (lastSuccessImportResult.error) {
    throw new Error(lastSuccessImportResult.error.message);
  }
  if (lastFailureResult.error) {
    throw new Error(lastFailureResult.error.message);
  }

  return {
    lastReceived: (lastReceivedResult.data as InboundEmailRecord | null) ?? null,
    lastSuccessfulImport: lastSuccessImportResult.data
      ? mapImportRecord(lastSuccessImportResult.data as Record<string, unknown>)
      : null,
    lastFailure: (lastFailureResult.data as InboundEmailRecord | null) ?? null,
  };
}

export async function updateServerImport(
  importId: string,
  input: {
    fieldMapping?: Record<string, string> | null;
    analysisSnapshot?: unknown | null;
    status?: ServerImportStatus;
    processingResult?: string | null;
    rowCount?: number;
    columnCount?: number;
    headers?: string[];
    processingDurationMs?: number | null;
    processingLog?: ProcessingLogEntry[];
    errorCount?: number;
    doorCount?: number;
    incidentCount?: number;
    complianceScoreSnapshot?: number | null;
    reportingPeriodStart?: string | null;
    reportingPeriodEnd?: string | null;
    hasAnalytics?: boolean;
    hasDurationField?: boolean;
    originalFilePath?: string | null;
    failedCsvPath?: string | null;
    failedCsvRetentionUntil?: string | null;
  },
): Promise<ServerImportRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .update({
      field_mapping: input.fieldMapping,
      analysis_snapshot: input.analysisSnapshot,
      status: input.status,
      processing_result: input.processingResult,
      row_count: input.rowCount,
      column_count: input.columnCount,
      headers: input.headers,
      processing_duration_ms: input.processingDurationMs,
      processing_log: input.processingLog,
      error_count: input.errorCount,
      door_count: input.doorCount,
      incident_count: input.incidentCount,
      compliance_score_snapshot: input.complianceScoreSnapshot,
      reporting_period_start: input.reportingPeriodStart,
      reporting_period_end: input.reportingPeriodEnd,
      has_analytics: input.hasAnalytics,
      has_duration_field: input.hasDurationField,
      original_file_path: input.originalFilePath,
      failed_csv_path: input.failedCsvPath,
      failed_csv_retention_until: input.failedCsvRetentionUntil,
    })
    .eq("id", importId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update import: ${error.message}`);
  }

  return mapImportRecord(data as Record<string, unknown>);
}

export async function downloadCsvFromStorage(
  storagePath: string,
  bucket: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download CSV from storage: ${error?.message ?? "Unknown error"}`);
  }

  return data.text();
}

export async function deleteCsvFromStorage(
  storagePath: string,
  bucket: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);

  if (error) {
    console.warn(
      JSON.stringify({
        scope: "imports-storage",
        event: "delete-warning",
        path: storagePath,
        message: error.message,
      }),
    );
  }
}

export async function listImportsWithAnalytics(): Promise<ServerImportRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .eq("has_analytics", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list imports for refresh: ${error.message}`);
  }

  return ((data as Record<string, unknown>[]) ?? []).map(mapImportRecord);
}

export async function listImportsWithAnalysisSnapshot(): Promise<ServerImportRecord[]> {
  return listImportsWithAnalytics();
}

export async function uploadCsvToStorage(
  storagePath: string,
  csvText: string,
  bucket: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(
    storagePath,
    Buffer.from(csvText, "utf-8"),
    {
      contentType: "text/csv",
      upsert: false,
    },
  );

  if (error) {
    throw new Error(`Failed to upload CSV to storage: ${error.message}`);
  }
}
