import type { CsvRow, FieldMapping } from "@/lib/imports/types";
import { extractDurationFromRow } from "@/lib/reports/door-event-analysis";
import { parseEventTimestamp } from "@/lib/reports/door-event-analysis";
import { findDurationColumns } from "@/lib/reports/held-open-detection";
import type { ParsedFireExitEvent } from "./types";

function getFieldValue(
  row: CsvRow,
  mapping: FieldMapping,
  key: keyof FieldMapping,
): string {
  const column = mapping[key];
  return column ? row[column]?.trim() ?? "" : "";
}

export function parseFireExitEvents(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
): { events: ParsedFireExitEvent[]; hasDurationField: boolean } {
  const durationColumns = findDurationColumns(headers, mapping);
  const events: ParsedFireExitEvent[] = [];

  for (const row of rows) {
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
    grouped.set(
      door,
      [...doorEvents].sort((a, b) => a.timestamp - b.timestamp),
    );
  }

  return grouped;
}
