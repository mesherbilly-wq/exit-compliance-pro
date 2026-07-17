import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "@/lib/reports/door-event-analysis";
import { isHeldOpenEvent } from "@/lib/reports/held-open-detection";
import {
  classificationFromExplicitAlarm,
  getIncidentDisplayLabel,
} from "./incident-classification";
import { buildIncidentTrace } from "./incident-trace";
import { dedupeIncidents } from "./dedupe-parsed-events";
import {
  logDoorOpenClosePairings,
  pairDoorOpenCloseSessions,
  type DoorOpenCloseSession,
} from "./door-open-close-pairing";
import { sortEventsDeterministic } from "./sort-events";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  IncidentDurationBucket,
  ParsedFireExitEvent,
  RiskRating,
} from "./types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ActiveIncidentState = {
  door: string;
  openStart: ParsedFireExitEvent;
  thresholdCrossedTimestamp: number;
  triggerEventType: string;
  isExplicitAlarm: boolean;
};

export type BuildComplianceIncidentsOptions = {
  includeTrace?: boolean;
};

export function getIncidentDurationBucket(
  timeBeyondThresholdSeconds: number,
): IncidentDurationBucket {
  if (timeBeyondThresholdSeconds < 60) {
    return "Brief";
  }

  if (timeBeyondThresholdSeconds < 300) {
    return "Moderate";
  }

  if (timeBeyondThresholdSeconds < 900) {
    return "Extended";
  }

  return "Critical";
}

export function getIncidentRiskRating(
  timeBeyondThresholdSeconds: number,
  durationSeconds: number,
): RiskRating {
  if (timeBeyondThresholdSeconds <= 0) {
    return "Low";
  }

  if (timeBeyondThresholdSeconds < 60 && durationSeconds < 120) {
    return "Low";
  }

  if (timeBeyondThresholdSeconds < 180) {
    return "Medium";
  }

  if (timeBeyondThresholdSeconds < 600) {
    return "High";
  }

  return "Critical";
}

function formatTimestampLabel(timestamp: number, fallback: string): string {
  if (!Number.isFinite(timestamp)) {
    return fallback;
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

function buildIncident(
  door: string,
  openStart: ParsedFireExitEvent,
  endEvent: ParsedFireExitEvent,
  thresholdSeconds: number,
  isExplicitAlarm: boolean,
  nativeEventType: string,
  qualificationReason: string,
  options?: BuildComplianceIncidentsOptions,
): ComplianceIncident {
  const endTimestamp = endEvent.timestamp;
  const endTimeLabel = endEvent.eventTime;
  const durationSeconds = Math.max(
    0,
    (endTimestamp - openStart.timestamp) / 1000,
  );
  const thresholdCrossedTimestamp =
    openStart.timestamp + thresholdSeconds * 1000;
  const timeBeyondThresholdSeconds = Math.max(
    0,
    durationSeconds - thresholdSeconds,
  );
  const startTimestamp =
    timeBeyondThresholdSeconds > 0
      ? thresholdCrossedTimestamp
      : openStart.timestamp;
  const startDate = new Date(startTimestamp);
  const classification = classificationFromExplicitAlarm(isExplicitAlarm);

  const incident: ComplianceIncident = {
    door,
    startTimestamp,
    endTimestamp,
    startTimeLabel: formatTimestampLabel(startTimestamp, openStart.eventTime),
    endTimeLabel,
    durationSeconds,
    thresholdSeconds,
    timeBeyondThresholdSeconds,
    riskRating: getIncidentRiskRating(timeBeyondThresholdSeconds, durationSeconds),
    durationBucket: getIncidentDurationBucket(timeBeyondThresholdSeconds),
    dayStarted: DAY_LABELS[startDate.getDay()] ?? "N/A",
    hourStarted: startDate.getHours(),
    isExplicitAlarm,
    classification,
    eventType: getIncidentDisplayLabel(classification, nativeEventType),
  };

  if (options?.includeTrace) {
    incident.trace = buildIncidentTrace({
      openEvent: openStart,
      closeEvent: endEvent,
      durationSeconds,
      thresholdSeconds,
      timeBeyondThresholdSeconds,
      classification,
      qualificationReason,
    });
  }

  return incident;
}

function finalizeActiveIncident(
  active: ActiveIncidentState,
  endEvent: ParsedFireExitEvent,
  thresholdSeconds: number,
  options?: BuildComplianceIncidentsOptions,
): ComplianceIncident {
  return buildIncident(
    active.door,
    active.openStart,
    endEvent,
    thresholdSeconds,
    active.isExplicitAlarm,
    active.triggerEventType,
    "Native held-open alarm followed door open until close",
    options,
  );
}

function tryStartActiveIncident(
  event: ParsedFireExitEvent,
  openStart: ParsedFireExitEvent,
  thresholdSeconds: number,
): ActiveIncidentState | null {
  const elapsedMs = event.timestamp - openStart.timestamp;
  const thresholdMs = thresholdSeconds * 1000;

  if (elapsedMs < thresholdMs) {
    return null;
  }

  return {
    door: event.door,
    openStart,
    thresholdCrossedTimestamp: openStart.timestamp + thresholdMs,
    triggerEventType: event.eventType,
    isExplicitAlarm: true,
  };
}

/** Native held-open alarm incidents only (explicit alarms and orphan alarms). */
export function buildNativeAlarmIncidents(
  events: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
  options?: BuildComplianceIncidentsOptions,
): ComplianceIncident[] {
  const thresholdSeconds = config.heldOpenThresholdSeconds;
  const sorted = sortEventsDeterministic(events);
  const incidents: ComplianceIncident[] = [];
  let openStart: ParsedFireExitEvent | null = null;
  let activeIncident: ActiveIncidentState | null = null;

  for (const event of sorted) {
    if (isDoorOpenedEvent(event.eventType)) {
      openStart = event;
      activeIncident = null;
      continue;
    }

    if (isDoorClosedEvent(event.eventType)) {
      if (activeIncident && openStart) {
        incidents.push(
          finalizeActiveIncident(
            activeIncident,
            event,
            thresholdSeconds,
            options,
          ),
        );
      }

      openStart = null;
      activeIncident = null;
      continue;
    }

    if (!isHeldOpenEvent(event.eventType)) {
      continue;
    }

    if (activeIncident) {
      continue;
    }

    if (openStart) {
      const started = tryStartActiveIncident(event, openStart, thresholdSeconds);
      if (started) {
        activeIncident = started;
      }
      continue;
    }

    const csvDuration = event.csvDurationSeconds;
    if (csvDuration !== null && csvDuration > thresholdSeconds) {
      const inferredOpenTimestamp = event.timestamp - csvDuration * 1000;
      const syntheticOpen: ParsedFireExitEvent = {
        door: event.door,
        eventType: "Door opened (inferred)",
        eventTime: event.eventTime,
        timestamp: inferredOpenTimestamp,
        csvDurationSeconds: null,
        sourceImportId: event.sourceImportId,
        sourceRowNumber: event.sourceRowNumber,
        sourceSequence: event.sourceSequence,
        sourceEventId: event.sourceEventId,
        sourceSystem: event.sourceSystem,
        site: event.site,
      };

      incidents.push(
        buildIncident(
          event.door,
          syntheticOpen,
          event,
          thresholdSeconds,
          true,
          event.eventType,
          "Native held-open alarm with CSV duration exceeding threshold",
          options,
        ),
      );
    }
  }

  return incidents;
}

/**
 * Canonical per-door incident builder: native alarms + derived open/close pairs.
 */
export function buildComplianceIncidents(
  events: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
  options?: BuildComplianceIncidentsOptions,
): ComplianceIncident[] {
  if (process.env.DOOR_PAIRING_DEBUG === "1" && events.length > 0) {
    logDoorOpenClosePairings(events[0]!.door, events);
    pairDoorOpenCloseSessions(events, { debug: true });
  }

  const sorted = sortEventsDeterministic(events);
  const native = buildNativeAlarmIncidents(sorted, config, options);
  const pairing = pairDoorOpenCloseSessions(sorted);
  const derived = buildDerivedIncidentsFromSessions(
    pairing.sessions,
    config,
    options,
  ).filter(
    (incident) =>
      !native.some(
        (nativeIncident) =>
          nativeIncident.door === incident.door &&
          nativeIncident.endTimestamp === incident.endTimestamp,
      ),
  );

  return dedupeIncidents([...native, ...derived]).sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );
}

export function buildDerivedIncidentsFromSessions(
  sessions: DoorOpenCloseSession[],
  config: FireExitAnalyticsConfig,
  options?: BuildComplianceIncidentsOptions,
): ComplianceIncident[] {
  const thresholdSeconds = config.heldOpenThresholdSeconds;
  const incidents: ComplianceIncident[] = [];

  for (const session of sessions) {
    if (session.durationSeconds <= thresholdSeconds) {
      continue;
    }

    incidents.push(
      buildIncident(
        session.door,
        session.openEvent,
        session.closeEvent,
        thresholdSeconds,
        false,
        "",
        session.crossImport
          ? "Cross-import open/close duration exceeded configured threshold"
          : "Open/close duration exceeded configured threshold",
        options,
      ),
    );
  }

  return incidents;
}
