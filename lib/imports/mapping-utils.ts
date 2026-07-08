import {
  GENETEC_FIELDS,
  REQUIRED_FIELD_KEYS,
  type FieldMapping,
  type GenetecFieldKey,
  type ImportRecord,
} from "@/lib/imports/types";

export function getMappedFieldCount(mapping: FieldMapping): number {
  return GENETEC_FIELDS.filter((field) => mapping[field.key].trim() !== "")
    .length;
}

export function getMappingCompleteness(mapping: FieldMapping): number {
  return Math.round((getMappedFieldCount(mapping) / GENETEC_FIELDS.length) * 100);
}

export function areRequiredFieldsMapped(mapping: FieldMapping): boolean {
  return REQUIRED_FIELD_KEYS.every((key) => mapping[key].trim() !== "");
}

export function sanitizeMappingForHeaders(
  mapping: FieldMapping,
  headers: string[],
): FieldMapping {
  const sanitized = { ...mapping };

  for (const field of GENETEC_FIELDS) {
    if (sanitized[field.key] && !headers.includes(sanitized[field.key])) {
      sanitized[field.key] = "";
    }
  }

  return sanitized;
}

export function getMappingSummary(importRecord: ImportRecord) {
  return {
    fileName: importRecord.fileName,
    rowCount: importRecord.rowCount,
    headerCount: importRecord.headers.length,
  };
}

export type { FieldMapping, GenetecFieldKey };
