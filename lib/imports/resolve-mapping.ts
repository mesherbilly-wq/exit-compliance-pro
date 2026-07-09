import type { CsvRow, FieldMapping, GenetecFieldKey } from "./types";
import { autoDetectFieldMapping } from "./auto-detect";
import { sanitizeMappingForHeaders } from "./mapping-utils";

const EVENT_TYPE_PATTERN =
  /door\s+(opened|closed|open too long)|forced\s*open|held\s*open|propped|ajar/i;
const EVENT_TIME_PATTERN =
  /\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?/i;

const REQUIRED_KEYS: GenetecFieldKey[] = ["eventTime", "eventType", "doorName"];

export function looksLikeEventType(value: string): boolean {
  return EVENT_TYPE_PATTERN.test(value.trim());
}

export function looksLikeEventTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (EVENT_TIME_PATTERN.test(trimmed)) {
    return true;
  }

  const parsed = Date.parse(trimmed);
  return !Number.isNaN(parsed);
}

export function looksLikeDoorName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 3) return false;

  return !looksLikeEventType(trimmed) && !looksLikeEventTime(trimmed);
}

export function looksLikeHeaderlessExport(headers: string[]): boolean {
  if (headers.length < 2 || headers.length > 4) {
    return false;
  }

  const eventTypeMatches = headers.filter((header) =>
    looksLikeEventType(header),
  ).length;
  const timeMatches = headers.filter((header) => looksLikeEventTime(header)).length;

  return eventTypeMatches >= 1 && timeMatches >= 1;
}

export function fixHeaderlessCsvParse(
  headers: string[],
  rows: CsvRow[],
): { headers: string[]; rows: CsvRow[] } {
  const fixedHeaders = ["Event Type", "Door Name", "Event Time"];

  const fixedRows: CsvRow[] = [
    {
      "Event Type": headers[0] ?? "",
      "Door Name": headers[1] ?? "",
      "Event Time": headers[2] ?? "",
    },
  ];

  for (const row of rows) {
    const values = Object.values(row);
    fixedRows.push({
      "Event Type": String(values[0] ?? "").trim(),
      "Door Name": String(values[1] ?? "").trim(),
      "Event Time": String(values[2] ?? "").trim(),
    });
  }

  return { headers: fixedHeaders, rows: fixedRows };
}

function scoreColumn(values: string[]) {
  const sample = values.filter(Boolean);
  if (sample.length === 0) {
    return { eventTime: 0, eventType: 0, doorName: 0 };
  }

  const eventType = sample.filter(looksLikeEventType).length / sample.length;
  const eventTime = sample.filter(looksLikeEventTime).length / sample.length;
  const doorName = sample.filter(looksLikeDoorName).length / sample.length;

  return { eventTime, eventType, doorName };
}

export function inferFieldMappingFromRows(
  headers: string[],
  rows: CsvRow[],
): FieldMapping {
  const columns =
    headers.length > 0 ? headers : Object.keys(rows[0] ?? {}).filter(Boolean);
  const sample = rows.slice(0, Math.min(rows.length, 50));

  const columnScores = columns.map((column) => ({
    column,
    scores: scoreColumn(sample.map((row) => row[column]?.trim() ?? "")),
  }));

  const mapping = autoDetectFieldMapping(headers);
  const usedColumns = new Set<string>();

  for (const fieldKey of REQUIRED_KEYS) {
    const best = columnScores
      .filter(({ column }) => !usedColumns.has(column))
      .map(({ column, scores }) => ({
        column,
        score: scores[fieldKey as keyof typeof scores],
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (best && best.score >= 0.4) {
      mapping[fieldKey] = best.column;
      usedColumns.add(best.column);
    }
  }

  return mapping;
}

export function isMappingValid(mapping: FieldMapping, rows: CsvRow[]): boolean {
  if (
    !mapping.eventTime.trim() ||
    !mapping.eventType.trim() ||
    !mapping.doorName.trim()
  ) {
    return false;
  }

  const sample = rows.slice(0, Math.min(rows.length, 20));
  if (sample.length === 0) {
    return false;
  }

  let validTime = 0;
  let validType = 0;
  let validDoor = 0;

  for (const row of sample) {
    const eventTime = row[mapping.eventTime]?.trim() ?? "";
    const eventType = row[mapping.eventType]?.trim() ?? "";
    const doorName = row[mapping.doorName]?.trim() ?? "";

    if (looksLikeEventTime(eventTime)) validTime += 1;
    if (looksLikeEventType(eventType)) validType += 1;
    if (looksLikeDoorName(doorName)) validDoor += 1;
  }

  const threshold = Math.max(1, Math.ceil(sample.length * 0.5));
  return (
    validTime >= threshold && validType >= threshold && validDoor >= threshold
  );
}

export function resolveFieldMapping(
  headers: string[],
  rows: CsvRow[],
  savedMapping?: FieldMapping | null,
): FieldMapping {
  const sanitized = savedMapping
    ? sanitizeMappingForHeaders(savedMapping, headers)
    : null;

  if (sanitized && isMappingValid(sanitized, rows)) {
    return sanitized;
  }

  const inferred = inferFieldMappingFromRows(headers, rows);
  if (isMappingValid(inferred, rows)) {
    return inferred;
  }

  const headerDetected = autoDetectFieldMapping(headers);
  if (isMappingValid(headerDetected, rows)) {
    return headerDetected;
  }

  return inferred.eventTime && inferred.eventType && inferred.doorName
    ? inferred
    : headerDetected;
}
