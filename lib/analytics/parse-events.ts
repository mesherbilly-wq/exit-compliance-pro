import type { CsvRow, FieldMapping } from "@/lib/imports/types";
import { extractDurationFromRow } from "@/lib/reports/door-event-analysis";
import { parseEventTimestamp } from "@/lib/reports/door-event-analysis";
import { findDurationColumns } from "@/lib/reports/held-open-detection";
import { sortEventsDeterministic } from "./sort-events";
import type { ParsedFireExitEvent } from "./types";

const DEFAULT_SOURCE_SYSTEM = "genetec";

export type ParseFireExitEventsOptions = {
  sourceImportId?: string;
  sourceSystem?: string;
  site?: string;
};

function getFieldValue(
  row: CsvRow,
  mapping: FieldMapping,
  key: keyof FieldMapping,
): string {
  const column = mapping[key];
  return column ? row[column]?.trim() ?? "" : "";
}

function getSourceEventId(row: CsvRow, mapping: FieldMapping): string | undefined {
  const candidates = ["eventId", "eventGuid", "guid", "id"] as const;
  for (const key of candidates) {
    const column = mapping[key as keyof FieldMapping];
    if (column && row[column]?.trim()) {
      return row[column]!.trim();
    }
  }

  for (const [header, value] of Object.entries(row)) {
    if (/guid|event.?id/i.test(header) && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function parseFireExitEvents(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
  options?: ParseFireExitEventsOptions,
): { events: ParsedFireExitEvent[]; hasDurationField: boolean } {
  const durationColumns = findDurationColumns(headers, mapping);
  const events: ParsedFireExitEvent[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const eventType = getFieldValue(row, mapping, "eventType");
    const doorName = getFieldValue(row, mapping, "doorName") || "Unknown exit door";
    const eventTime = getFieldValue(row, mapping, "eventTime");
    const timestamp = parseEventTimestamp(eventTime);

    if (timestamp === null) {
      continue;
    }

    events.push({
      door: doorName,
      eventType,
      eventTime,
      timestamp,
      csvDurationSeconds: extractDurationFromRow(
        row,
        eventType,
        durationColumns,
      ),
      sourceImportId: options?.sourceImportId,
      sourceRowNumber: index + 2,
      sourceSequence: index,
      sourceEventId: getSourceEventId(row, mapping),
      sourceSystem: options?.sourceSystem ?? DEFAULT_SOURCE_SYSTEM,
      site: options?.site,
    });
  }

  return {
    events,
    hasDurationField: durationColumns.length > 0,
  };
}

export function groupEventsByDoor(
  events: ParsedFireExitEvent[],
): Map<string, ParsedFireExitEvent[]> {
  const grouped = new Map<string, ParsedFireExitEvent[]>();

  for (const event of events) {
    const doorEvents = grouped.get(event.door) ?? [];
    doorEvents.push(event);
    grouped.set(event.door, doorEvents);
  }

  for (const [door, doorEvents] of grouped) {
    grouped.set(door, sortEventsDeterministic(doorEvents));
  }

  return grouped;
}
