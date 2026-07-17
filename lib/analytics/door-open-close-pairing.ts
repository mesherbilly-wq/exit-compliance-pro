import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "@/lib/reports/door-event-analysis";
import { sortEventsDeterministic } from "./sort-events";
import type { ParsedFireExitEvent } from "./types";

export type DoorOpenCloseSession = {
  door: string;
  openEvent: ParsedFireExitEvent;
  closeEvent: ParsedFireExitEvent;
  durationSeconds: number;
  openEventId: string;
  closeEventId: string;
  crossImport: boolean;
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
    | "unclosed-open"
    | "cross-import-paired"
    | "expired-unmatched-open";
};

export type DoorOpenClosePairingResult = {
  sessions: DoorOpenCloseSession[];
  pendingOpen: ParsedFireExitEvent | null;
  orphanCloses: ParsedFireExitEvent[];
};

function buildEventId(event: ParsedFireExitEvent, index: number): string {
  return `${event.door}|${event.timestamp}|${event.eventType}|${index}`;
}

export function pairDoorOpenCloseSessions(
  events: ParsedFireExitEvent[],
  options?: {
    initialPendingOpen?: ParsedFireExitEvent | null;
    debug?: boolean;
    debugLogs?: DoorOpenClosePairingLogEntry[];
  },
): DoorOpenClosePairingResult {
  const sorted = sortEventsDeterministic(events);
  const sessions: DoorOpenCloseSession[] = [];
  const orphanCloses: ParsedFireExitEvent[] = [];
  let pendingOpen: { event: ParsedFireExitEvent; eventId: string } | null =
    options?.initialPendingOpen
      ? {
          event: options.initialPendingOpen,
          eventId: buildEventId(options.initialPendingOpen, -1),
        }
      : null;

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
      orphanCloses.push(event);
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

    const crossImport =
      pendingOpen.event.sourceImportId != null &&
      event.sourceImportId != null &&
      pendingOpen.event.sourceImportId !== event.sourceImportId;

    sessions.push({
      door: event.door,
      openEvent: pendingOpen.event,
      closeEvent: event,
      durationSeconds,
      openEventId: pendingOpen.eventId,
      closeEventId: eventId,
      crossImport,
    });

    if (options?.debug || options?.debugLogs) {
      options.debugLogs?.push({
        door: event.door,
        eventId,
        openTime: pendingOpen.event.eventTime,
        closeTime: event.eventTime,
        durationSeconds,
        matchedOpenEventId: pendingOpen.eventId,
        action: crossImport ? "cross-import-paired" : "paired",
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

  return {
    sessions,
    pendingOpen: pendingOpen?.event ?? null,
    orphanCloses,
  };
}

export function logDoorOpenClosePairings(
  door: string,
  events: ParsedFireExitEvent[],
): DoorOpenClosePairingLogEntry[] {
  const debugLogs: DoorOpenClosePairingLogEntry[] = [];
  pairDoorOpenCloseSessions(events, { debugLogs });

  for (const entry of debugLogs) {
    if (entry.action === "paired" || entry.action === "cross-import-paired") {
      console.info(
        `[door-pairing] Door: ${door} | Event ID: ${entry.eventId} | Open: ${entry.openTime} | Close: ${entry.closeTime} | Duration: ${entry.durationSeconds}s | Matched Open Event ID: ${entry.matchedOpenEventId}`,
      );
    }
  }

  return debugLogs;
}
