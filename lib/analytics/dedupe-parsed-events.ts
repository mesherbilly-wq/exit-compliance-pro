import type { ParsedFireExitEvent } from "./types";

export function getParsedEventKey(event: ParsedFireExitEvent): string {
  return `${event.door}|${event.timestamp}|${event.eventType}|${event.eventTime}`;
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

export function dedupeIncidents<T extends { door: string; startTimestamp: number; endTimestamp: number }>(
  incidents: T[],
): T[] {
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
