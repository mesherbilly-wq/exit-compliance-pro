import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "@/lib/reports/door-event-analysis";
import { isHeldOpenEvent } from "@/lib/reports/held-open-detection";
import {
  buildComplianceIncidentRecord,
  type BuildComplianceIncidentsOptions,
} from "../compliance-incidents";
import { dedupeIncidents } from "../dedupe-parsed-events";
import { sortEventsDeterministic } from "../sort-events";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  ParsedFireExitEvent,
} from "../types";

export type BuildGenetecIncidentsOptions = BuildComplianceIncidentsOptions;

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

function alarmKey(alarm: ParsedFireExitEvent): string {
  return [
    alarm.door,
    alarm.timestamp,
    alarm.sourceSequence ?? "",
    alarm.sourceEventId ?? "",
    alarm.eventType,
  ].join("|");
}

/** Last door-open event on the same door/site strictly before the alarm. */
export function findLastOpenBeforeAlarm(
  alarm: ParsedFireExitEvent,
  events: ParsedFireExitEvent[],
): ParsedFireExitEvent | null {
  let bestOpen: ParsedFireExitEvent | null = null;

  for (const event of events) {
    if (event.door !== alarm.door || !isDoorOpenedEvent(event.eventType)) {
      continue;
    }

    if (event.timestamp >= alarm.timestamp || !sameSite(event, alarm)) {
      continue;
    }

    if (!bestOpen || event.timestamp > bestOpen.timestamp) {
      bestOpen = event;
    }
  }

  return bestOpen;
}

/** First door-closed event on the same door/site strictly after the alarm. */
export function findFirstCloseAfterAlarm(
  alarm: ParsedFireExitEvent,
  events: ParsedFireExitEvent[],
): ParsedFireExitEvent | null {
  let bestClose: ParsedFireExitEvent | null = null;

  for (const event of events) {
    if (event.door !== alarm.door || !isDoorClosedEvent(event.eventType)) {
      continue;
    }

    if (event.timestamp <= alarm.timestamp || !sameSite(event, alarm)) {
      continue;
    }

    if (!bestClose || event.timestamp < bestClose.timestamp) {
      bestClose = event;
    }
  }

  return bestClose;
}

function buildOrphanAlarmIncident(
  alarm: ParsedFireExitEvent,
  thresholdSeconds: number,
  options?: BuildGenetecIncidentsOptions,
): ComplianceIncident | null {
  const csvDuration = alarm.csvDurationSeconds;

  if (csvDuration === null || csvDuration <= thresholdSeconds) {
    return null;
  }

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
    { ...options, anchorStartToOpenEvent: true },
  );
}

function buildAlarmAnchoredIncident(
  alarm: ParsedFireExitEvent,
  openEvent: ParsedFireExitEvent,
  closeEvent: ParsedFireExitEvent,
  thresholdSeconds: number,
  options?: BuildGenetecIncidentsOptions,
): ComplianceIncident | null {
  const durationSeconds = Math.max(
    0,
    (closeEvent.timestamp - openEvent.timestamp) / 1000,
  );

  if (durationSeconds <= thresholdSeconds) {
    const elapsedAtAlarmSeconds =
      (alarm.timestamp - openEvent.timestamp) / 1000;

    if (elapsedAtAlarmSeconds < thresholdSeconds) {
      return null;
    }
  }

  return buildComplianceIncidentRecord(
    alarm.door,
    openEvent,
    closeEvent,
    thresholdSeconds,
    true,
    alarm.eventType,
    "Native Genetec held-open alarm anchored to last open before alarm and first close after alarm",
    { ...options, anchorStartToOpenEvent: true },
  );
}

/**
 * Genetec compliance incidents are created only from explicit native held-open
 * alarms. Open/close duration alone never qualifies an incident.
 *
 * Incident timing is anchored on the alarm:
 * - start = last door open before the alarm
 * - end = first door closed after the alarm (or the alarm itself when no close)
 */
export function buildGenetecComplianceIncidents(
  events: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
  options?: BuildGenetecIncidentsOptions,
): ComplianceIncident[] {
  const thresholdSeconds = config.heldOpenThresholdSeconds;
  const sorted = sortEventsDeterministic(events);
  const alarmEvents = sorted.filter((event) => isHeldOpenEvent(event.eventType));
  const usedAlarms = new Set<string>();
  const incidents: ComplianceIncident[] = [];

  for (const alarm of alarmEvents) {
    const key = alarmKey(alarm);
    if (usedAlarms.has(key)) {
      continue;
    }

    const openEvent = findLastOpenBeforeAlarm(alarm, sorted);

    if (!openEvent) {
      const orphanIncident = buildOrphanAlarmIncident(
        alarm,
        thresholdSeconds,
        options,
      );

      if (orphanIncident) {
        usedAlarms.add(key);
        incidents.push(orphanIncident);
      }

      continue;
    }

    const closeEvent = findFirstCloseAfterAlarm(alarm, sorted) ?? alarm;
    const incident = buildAlarmAnchoredIncident(
      alarm,
      openEvent,
      closeEvent,
      thresholdSeconds,
      options,
    );

    if (incident) {
      usedAlarms.add(key);
      incidents.push(incident);
    }
  }

  return dedupeIncidents(incidents).sort(
    (left, right) => left.startTimestamp - right.startTimestamp,
  );
}
