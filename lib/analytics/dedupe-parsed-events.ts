import type { ParsedFireExitEvent } from "./types";

const DEFAULT_SOURCE_SYSTEM = "genetec";

/**
 * Stable dedupe key for events that may appear in overlapping hourly imports.
 * Import ID is intentionally excluded — the same physical event can repeat.
 */
export function getParsedEventKey(event: ParsedFireExitEvent): string {
  const parts = [
    event.sourceSystem ?? DEFAULT_SOURCE_SYSTEM,
    event.site ?? "",
    event.door,
    String(event.timestamp),
    event.eventType,
    event.eventTime,
  ];

  if (event.sourceEventId) {
    parts.push(`event:${event.sourceEventId}`);
  } else if (event.sourceRowNumber != null) {
    parts.push(`row:${event.sourceRowNumber}`);
  }

  return parts.join("|");
}

export function dedupeParsedEvents(
  events: ParsedFireExitEvent[],
): ParsedFireExitEvent[] {
  const seen = new Set<string>();
  const deduped: ParsedFireExitEvent[] = [];

  for (const event of events) {
    const key = getParsedEventKey(event);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

export function dedupeIncidents<
  T extends { door: string; startTimestamp: number; endTimestamp: number },
>(incidents: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const incident of incidents) {
    const key = `${incident.door}|${incident.startTimestamp}|${incident.endTimestamp}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(incident);
  }

  return deduped;
}

export function attachImportMetadata(
  events: ParsedFireExitEvent[],
  importId: string,
): ParsedFireExitEvent[] {
  return events.map((event) => ({
    ...event,
    sourceImportId: event.sourceImportId ?? importId,
  }));
}
