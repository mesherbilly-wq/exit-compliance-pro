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
  { key: "doorName", label: "Door name", required: true },
  { key: "cardholderName", label: "Cardholder name", required: false },
  { key: "cardholderEmail", label: "Cardholder email", required: false },
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
