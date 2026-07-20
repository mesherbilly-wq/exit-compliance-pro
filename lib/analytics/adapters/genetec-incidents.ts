import { isHeldOpenEvent } from "@/lib/reports/held-open-detection";
import {
  buildComplianceIncidentRecord,
  type BuildComplianceIncidentsOptions,
} from "../compliance-incidents";
import { dedupeIncidents } from "../dedupe-parsed-events";
import {
  pairDoorOpenCloseSessions,
  type DoorOpenCloseSession,
} from "../door-open-close-pairing";
import { sortEventsDeterministic } from "../sort-events";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  ParsedFireExitEvent,
} from "../types";

export type BuildGenetecIncidentsOptions = BuildComplianceIncidentsOptions & {
  sessions?: DoorOpenCloseSession[];
  initialPendingOpen?: ParsedFireExitEvent | null;
};

function sameSite(
  left: ParsedFireExitEvent,
  right: ParsedFireExitEvent,
): boolean {
  const leftSite = (left.site ?? "").trim();
  const rightSite = (right.site ?? "").trim();

  if (!leftSite || !rightSite) {
    return true;
  }

  return leftSite === rightSite;
}

function sessionKey(session: DoorOpenCloseSession): string {
  return `${session.door}|${session.openEvent.timestamp}|${session.closeEvent.timestamp}`;
}

function alarmKey(alarm: ParsedFireExitEvent): string {
  return [
    alarm.door,
    alarm.timestamp,
    alarm.sourceSequence ?? "",
    alarm.sourceEventId ?? "",
    alarm.eventType,
  ].join("|");
}

function hasCloseBetween(
  openEvent: ParsedFireExitEvent,
  alarm: ParsedFireExitEvent,
  events: ParsedFireExitEvent[],
): boolean {
  return events.some(
    (event) =>
      event.door === alarm.door &&
      event.eventType.toLowerCase().includes("door closed") &&
      event.timestamp > openEvent.timestamp &&
      event.timestamp < alarm.timestamp,
  );
}

function sessionMatchScore(
  alarm: ParsedFireExitEvent,
  session: DoorOpenCloseSession,
  thresholdSeconds: number,
): number {
  let score = 0;
  const alarmSeq = alarm.sourceSequence;
  const openSeq = session.openEvent.sourceSequence;
  const closeSeq = session.closeEvent.sourceSequence;

  if (
    alarmSeq != null &&
    openSeq != null &&
    closeSeq != null &&
    alarmSeq >= openSeq &&
    alarmSeq <= closeSeq
  ) {
    score += 1_000;
    score -= alarmSeq - openSeq;
  }

  const thresholdCrossedAt =
    session.openEvent.timestamp + thresholdSeconds * 1000;
  score -= Math.abs(alarm.timestamp - thresholdCrossedAt) / 1000;

  return score;
}

function findBestMatchingSession(
  alarm: ParsedFireExitEvent,
  sessions: DoorOpenCloseSession[],
  usedSessions: Set<string>,
  thresholdSeconds: number,
): DoorOpenCloseSession | null {
  const candidates = sessions.filter(
    (session) =>
      session.door === alarm.door &&
      sameSite(session.openEvent, alarm) &&
      session.openEvent.timestamp <= alarm.timestamp &&
      session.closeEvent.timestamp >= alarm.timestamp &&
      !usedSessions.has(sessionKey(session)),
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const leftScore = sessionMatchScore(alarm, left, thresholdSeconds);
    const rightScore = sessionMatchScore(alarm, right, thresholdSeconds);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.durationSeconds - right.durationSeconds;
  })[0]!;
}

function findOpenBeforeAlarm(
  alarm: ParsedFireExitEvent,
  events: ParsedFireExitEvent[],
): ParsedFireExitEvent | null {
  let bestOpen: ParsedFireExitEvent | null = null;

  for (const event of events) {
    if (event.door !== alarm.door) {
      continue;
    }

    if (!event.eventType.toLowerCase().includes("door opened")) {
      continue;
    }

    if (event.timestamp > alarm.timestamp) {
      continue;
    }

    if (!sameSite(event, alarm)) {
      continue;
    }

    if (!bestOpen || event.timestamp > bestOpen.timestamp) {
      bestOpen = event;
    }
  }

  return bestOpen;
}

function buildOrphanAlarmIncident(
  alarm: ParsedFireExitEvent,
  sortedEvents: ParsedFireExitEvent[],
  thresholdSeconds: number,
  options?: BuildGenetecIncidentsOptions,
): ComplianceIncident | null {
  const csvDuration = alarm.csvDurationSeconds;

  if (csvDuration !== null && csvDuration > thresholdSeconds) {
    const inferredOpenTimestamp = alarm.timestamp - csvDuration * 1000;
    const syntheticOpen: ParsedFireExitEvent = {
      door: alarm.door,
      eventType: "Door opened (inferred)",
      eventTime: alarm.eventTime,
      timestamp: inferredOpenTimestamp,
      csvDurationSeconds: null,
      sourceImportId: alarm.sourceImportId,
      sourceRowNumber: alarm.sourceRowNumber,
      sourceSequence: alarm.sourceSequence,
      sourceEventId: alarm.sourceEventId,
      sourceSystem: alarm.sourceSystem,
      site: alarm.site,
    };

    return buildComplianceIncidentRecord(
      alarm.door,
      syntheticOpen,
      alarm,
      thresholdSeconds,
      true,
      alarm.eventType,
      "Native Genetec held-open alarm with CSV duration exceeding threshold",
      options,
    );
  }

  const openBeforeAlarm = findOpenBeforeAlarm(alarm, sortedEvents);

  if (
    openBeforeAlarm &&
    !hasCloseBetween(openBeforeAlarm, alarm, sortedEvents)
  ) {
    const elapsedSeconds =
      (alarm.timestamp - openBeforeAlarm.timestamp) / 1000;

    if (elapsedSeconds >= thresholdSeconds) {
      return buildComplianceIncidentRecord(
        alarm.door,
        openBeforeAlarm,
        alarm,
        thresholdSeconds,
        true,
        alarm.eventType,
        "Native Genetec held-open alarm without matching close",
        options,
      );
    }
  }

  return null;
}

/**
 * Genetec compliance incidents are created only from explicit native held-open
 * alarms. Open/close duration alone never qualifies an incident.
 */
export function buildGenetecComplianceIncidents(
  events: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
  options?: BuildGenetecIncidentsOptions,
): ComplianceIncident[] {
  const thresholdSeconds = config.heldOpenThresholdSeconds;
  const sorted = sortEventsDeterministic(events);
  const pairing =
    options?.sessions != null
      ? {
          sessions: options.sessions,
          pendingOpen: options.initialPendingOpen ?? null,
          orphanCloses: [] as ParsedFireExitEvent[],
        }
      : pairDoorOpenCloseSessions(sorted, {
          initialPendingOpen: options?.initialPendingOpen ?? null,
        });

  const alarmEvents = sorted.filter((event) => isHeldOpenEvent(event.eventType));
  const usedSessions = new Set<string>();
  const usedAlarms = new Set<string>();
  const incidents: ComplianceIncident[] = [];

  for (const alarm of alarmEvents) {
    const key = alarmKey(alarm);
    if (usedAlarms.has(key)) {
      continue;
    }

    const matchedSession = findBestMatchingSession(
      alarm,
      pairing.sessions,
      usedSessions,
      thresholdSeconds,
    );

    if (matchedSession) {
      const elapsedAtAlarmSeconds =
        (alarm.timestamp - matchedSession.openEvent.timestamp) / 1000;

      if (
        elapsedAtAlarmSeconds >= thresholdSeconds ||
        matchedSession.durationSeconds > thresholdSeconds
      ) {
        usedSessions.add(sessionKey(matchedSession));
        usedAlarms.add(key);
        incidents.push(
          buildComplianceIncidentRecord(
            alarm.door,
            matchedSession.openEvent,
            matchedSession.closeEvent,
            thresholdSeconds,
            true,
            alarm.eventType,
            "Native Genetec held-open alarm matched to open/close session",
            options,
          ),
        );
      }

      continue;
    }

    const orphanIncident = buildOrphanAlarmIncident(
      alarm,
      sorted,
      thresholdSeconds,
      options,
    );

    if (orphanIncident) {
      usedAlarms.add(key);
      incidents.push(orphanIncident);
    }
  }

  return dedupeIncidents(incidents).sort(
    (left, right) => left.startTimestamp - right.startTimestamp,
  );
}
