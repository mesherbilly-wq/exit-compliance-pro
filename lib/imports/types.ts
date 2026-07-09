export type ImportStatus = "ready_for_mapping" | "mapped" | "processed";

export type CsvRow = Record<string, string>;

export const PREVIEW_ROW_LIMIT = 25;

export const PREVIEW_DATA_WARNING =
  "Analysis is currently based on preview data only. Full dataset processing will be added with backend storage.";

export const STORAGE_QUOTA_MESSAGE =
  "CSV is too large for browser storage. Backend import storage is required.";

export type ImportRecord = {
  id: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  status: ImportStatus;
  uploadedAt: string;
  previewRows: CsvRow[];
  analysisSnapshot?: ImportAnalysisSnapshot;
};

export type ImportAnalysisSnapshot = {
  mapping: FieldMapping;
  analyzedRowCount: number;
  intelligence: import("@/lib/analytics/types").FireExitIntelligenceReport;
  /** @deprecated Legacy snapshot fields */
  sourceFileName?: string;
  hasDurationField?: boolean;
  totalDoors?: number;
  excellentDoors?: number;
  doorsNeedingAttention?: number;
  criticalDoors?: number;
  worstDoor?: string;
  doors?: {
    door: string;
    totalEvents: number;
    heldOpenEvents: number;
    averageDurationLabel: string;
    longestDurationLabel: string;
    lastEventTime: string;
    complianceScore: number;
    status: string;
  }[];
};

export function isPreviewOnlyAnalysis(record: ImportRecord): boolean {
  if (record.analysisSnapshot) {
    return record.analysisSnapshot.analyzedRowCount < record.rowCount;
  }

  return record.rowCount > PREVIEW_ROW_LIMIT;
}

export type GenetecFieldKey =
  | "eventTime"
  | "eventType"
  | "doorName"
  | "cardholderName"
  | "cardholderEmail"
  | "credentialNumber"
  | "accessResult"
  | "siteBuilding";

export type FieldMapping = Record<GenetecFieldKey, string>;

export type GenetecFieldDefinition = {
  key: GenetecFieldKey;
  label: string;
  required: boolean;
};

export const GENETEC_FIELDS: GenetecFieldDefinition[] = [
  { key: "eventTime", label: "Event time", required: true },
  { key: "eventType", label: "Event type", required: true },
  { key: "doorName", label: "Exit door name", required: true },
  { key: "cardholderName", label: "Cardholder name (optional)", required: false },
  { key: "cardholderEmail", label: "Cardholder email (optional)", required: false },
  { key: "credentialNumber", label: "Credential/card number", required: false },
  { key: "accessResult", label: "Access result", required: false },
  { key: "siteBuilding", label: "Site/building", required: false },
];

export const REQUIRED_FIELD_KEYS: GenetecFieldKey[] = GENETEC_FIELDS.filter(
  (field) => field.required,
).map((field) => field.key);

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  ready_for_mapping: "Ready for mapping",
  mapped: "Mapped",
  processed: "Processed",
};
