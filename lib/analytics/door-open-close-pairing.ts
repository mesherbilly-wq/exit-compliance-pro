import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "@/lib/reports/door-event-analysis";
import type { ParsedFireExitEvent } from "./types";

export type DoorOpenCloseSession = {
  door: string;
  openEvent: ParsedFireExitEvent;
  closeEvent: ParsedFireExitEvent;
  durationSeconds: number;
  openEventId: string;
  closeEventId: string;
};

export type DoorOpenClosePairingLogEntry = {
  door: string;
  eventId: string;
  openTime: string;
  closeTime: string;
  durationSeconds: number | null;
  matchedOpenEventId: string | null;
  action:
    | "paired"
    | "orphan-close"
    | "duplicate-open-replaced"
    | "unclosed-open";
};

function buildEventId(event: ParsedFireExitEvent, index: number): string {
  return `${event.door}|${event.timestamp}|${event.eventType}|${index}`;
}

export function pairDoorOpenCloseSessions(
  events: ParsedFireExitEvent[],
  options?: {
    debug?: boolean;
    debugLogs?: DoorOpenClosePairingLogEntry[];
  },
): DoorOpenCloseSession[] {
  const sorted = [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }

    return a.eventTime.localeCompare(b.eventTime);
  });

  const sessions: DoorOpenCloseSession[] = [];
  let pendingOpen: { event: ParsedFireExitEvent; eventId: string } | null = null;

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index]!;
    const eventId = buildEventId(event, index);

    if (isDoorOpenedEvent(event.eventType)) {
      if (pendingOpen) {
        options?.debugLogs?.push({
          door: event.door,
          eventId,
          openTime: pendingOpen.event.eventTime,
          closeTime: event.eventTime,
          durationSeconds: null,
          matchedOpenEventId: pendingOpen.eventId,
          action: "duplicate-open-replaced",
        });
      }

      pendingOpen = { event, eventId };
      continue;
    }

    if (!isDoorClosedEvent(event.eventType)) {
      continue;
    }

    if (!pendingOpen || pendingOpen.event.door !== event.door) {
      options?.debugLogs?.push({
        door: event.door,
        eventId,
        openTime: "N/A",
        closeTime: event.eventTime,
        durationSeconds: null,
        matchedOpenEventId: null,
        action: "orphan-close",
      });
      continue;
    }

    const durationSeconds = Math.max(
      0,
      (event.timestamp - pendingOpen.event.timestamp) / 1000,
    );

    sessions.push({
      door: event.door,
      openEvent: pendingOpen.event,
      closeEvent: event,
      durationSeconds,
      openEventId: pendingOpen.eventId,
      closeEventId: eventId,
    });

    if (options?.debug || options?.debugLogs) {
      options.debugLogs?.push({
        door: event.door,
        eventId,
        openTime: pendingOpen.event.eventTime,
        closeTime: event.eventTime,
        durationSeconds,
        matchedOpenEventId: pendingOpen.eventId,
        action: "paired",
      });
    }

    pendingOpen = null;
  }

  if (pendingOpen) {
    options?.debugLogs?.push({
      door: pendingOpen.event.door,
      eventId: pendingOpen.eventId,
      openTime: pendingOpen.event.eventTime,
      closeTime: "N/A",
      durationSeconds: null,
      matchedOpenEventId: pendingOpen.eventId,
      action: "unclosed-open",
    });
  }

  return sessions;
}

export function logDoorOpenClosePairings(
  door: string,
  events: ParsedFireExitEvent[],
): DoorOpenClosePairingLogEntry[] {
  const debugLogs: DoorOpenClosePairingLogEntry[] = [];
  pairDoorOpenCloseSessions(events, { debugLogs });

  for (const entry of debugLogs) {
    if (entry.action === "paired") {
      console.info(
        `[door-pairing] Door: ${door} | Event ID: ${entry.eventId} | Open: ${entry.openTime} | Close: ${entry.closeTime} | Duration: ${entry.durationSeconds}s | Matched Open Event ID: ${entry.matchedOpenEventId}`,
      );
    }
  }

  return debugLogs;
}
