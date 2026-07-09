import {
  isHeldOpenEvent,
  parseDurationSeconds,
} from "./held-open-detection";
import {
  looksLikeEventTime,
  looksLikeEventType,
} from "@/lib/imports/resolve-mapping";

export function isDoorOpenedEvent(eventType: string): boolean {
  const text = eventType.toLowerCase();
  return text.includes("door opened") || text === "opened";
}

export function isDoorClosedEvent(eventType: string): boolean {
  const text = eventType.toLowerCase();
  return text.includes("door closed") || text === "closed";
}

export function parseEventTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || looksLikeEventType(trimmed)) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatEventTimeLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "N/A";

  if (looksLikeEventType(trimmed)) {
    return "N/A";
  }

  if (/\d{1,2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed;
  }

  const timestamp = parseEventTimestamp(trimmed);
  if (timestamp === null) {
    return trimmed;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

export type DoorTimelineEvent = {
  eventType: string;
  eventTime: string;
  timestamp: number;
};

export type DoorTimelineStats = {
  openDurations: number[];
  heldOpenEvents: number;
};

export function computeDoorTimelineStats(
  events: DoorTimelineEvent[],
): DoorTimelineStats {
  const sorted = [...events]
    .filter((event) => event.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const openDurations: number[] = [];
  let heldOpenEvents = 0;
  let lastOpenTimestamp: number | null = null;

  for (const event of sorted) {
    if (isDoorOpenedEvent(event.eventType)) {
      lastOpenTimestamp = event.timestamp;
      continue;
    }

    if (isDoorClosedEvent(event.eventType)) {
      if (
        lastOpenTimestamp !== null &&
        event.timestamp >= lastOpenTimestamp
      ) {
        openDurations.push((event.timestamp - lastOpenTimestamp) / 1000);
      }
      lastOpenTimestamp = null;
      continue;
    }

    if (isHeldOpenEvent(event.eventType)) {
      heldOpenEvents += 1;

      if (
        lastOpenTimestamp !== null &&
        event.timestamp >= lastOpenTimestamp
      ) {
        openDurations.push((event.timestamp - lastOpenTimestamp) / 1000);
      }
    }
  }

  return { openDurations, heldOpenEvents };
}

export function extractDurationFromRow(
  row: Record<string, string>,
  eventType: string,
  durationColumns: string[],
): number | null {
  for (const column of durationColumns) {
    const fromColumn = parseDurationSeconds(row[column] ?? "");
    if (fromColumn !== null) {
      return fromColumn;
    }
  }

  return parseDurationSeconds(eventType) ?? null;
}

export function getLatestEventTimeLabel(events: DoorTimelineEvent[]): string {
  if (events.length === 0) {
    return "N/A";
  }

  const latest = [...events]
    .filter((event) => event.timestamp !== null)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!latest) {
    return "N/A";
  }

  return formatEventTimeLabel(latest.eventTime);
}

export function hasValidEventTimestamps(events: DoorTimelineEvent[]): boolean {
  return events.some(
    (event) =>
      event.timestamp !== null && looksLikeEventTime(event.eventTime),
  );
}
