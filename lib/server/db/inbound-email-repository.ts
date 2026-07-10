import { getSupabaseAdmin } from "@/lib/server/supabase/admin";
import type {
  InboundEmailRecord,
  InboundEmailStatus,
  ServerImportListItem,
  ServerImportRecord,
  ServerImportStatus,
} from "@/lib/server/types/inbound-email";

function mapImportListItem(row: ServerImportRecord): ServerImportListItem {
  return {
    id: row.id,
    source: row.source,
    fileName: row.file_name,
    sender: row.inbound_emails?.from_address ?? null,
    emailSubject: row.inbound_emails?.subject ?? null,
    receivedAt: row.inbound_emails?.received_at ?? row.created_at,
    status: row.status,
    rowCount: row.row_count,
    processingResult: row.processing_result,
    createdAt: row.created_at,
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
  source: "manual_upload" | "inbound_email";
  fileName: string;
  originalFilePath?: string | null;
  rowCount: number;
  columnCount: number;
  headers: string[];
  fieldMapping?: Record<string, string> | null;
  analysisSnapshot?: unknown | null;
  status: ServerImportStatus;
  inboundEmailId?: string | null;
  processingResult?: string | null;
}): Promise<ServerImportRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .insert({
      source: input.source,
      file_name: input.fileName,
      original_file_path: input.originalFilePath ?? null,
      row_count: input.rowCount,
      column_count: input.columnCount,
      headers: input.headers,
      field_mapping: input.fieldMapping ?? null,
      analysis_snapshot: input.analysisSnapshot ?? null,
      status: input.status,
      inbound_email_id: input.inboundEmailId ?? null,
      processing_result: input.processingResult ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create import record: ${error.message}`);
  }

  return data as ServerImportRecord;
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
    .eq("source", "inbound_email")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to list server imports: ${error.message}`);
  }

  return ((data as ServerImportRecord[]) ?? []).map(mapImportListItem);
}

export async function getServerImportById(
  importId: string,
): Promise<ServerImportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load import: ${error.message}`);
  }

  return (data as ServerImportRecord | null) ?? null;
}

export async function deleteServerImport(
  importId: string,
  bucket: string,
): Promise<void> {
  const importRecord = await getServerImportById(importId);

  if (!importRecord) {
    throw new Error("Import not found.");
  }

  if (importRecord.source !== "inbound_email") {
    throw new Error("Only inbound email imports can be deleted from this endpoint.");
  }

  const supabase = getSupabaseAdmin();

  if (importRecord.original_file_path) {
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([importRecord.original_file_path]);

    if (storageError) {
      console.warn(
        JSON.stringify({
          scope: "imports-api",
          event: "storage-delete-warning",
          importId,
          path: importRecord.original_file_path,
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
    lastSuccessfulImport:
      (lastSuccessImportResult.data as ServerImportRecord | null) ?? null,
    lastFailure: (lastFailureResult.data as InboundEmailRecord | null) ?? null,
  };
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
