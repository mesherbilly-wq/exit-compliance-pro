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
};
