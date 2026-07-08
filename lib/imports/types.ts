export type ImportStatus = "ready_for_mapping" | "mapped" | "processed";

export type ImportRecord = {
  id: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  status: ImportStatus;
  uploadedAt: string;
};

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  ready_for_mapping: "Ready for mapping",
  mapped: "Mapped",
  processed: "Processed",
};
