import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "@/lib/reports/door-event-analysis";
import { isHeldOpenEvent } from "@/lib/reports/held-open-detection";
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
  endTimestamp: number,
  endTimeLabel: string,
  thresholdSeconds: number,
  triggerEventType: string,
  isExplicitAlarm: boolean,
): ComplianceIncident {
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

  return {
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
    eventType: triggerEventType,
  };
}

function finalizeActiveIncident(
  active: ActiveIncidentState,
  endEvent: ParsedFireExitEvent,
  thresholdSeconds: number,
): ComplianceIncident {
  return buildIncident(
    active.door,
    active.openStart,
    endEvent.timestamp,
    endEvent.eventTime,
    thresholdSeconds,
    active.triggerEventType,
    active.isExplicitAlarm,
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

export function buildComplianceIncidents(
  events: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
): ComplianceIncident[] {
  const thresholdSeconds = config.heldOpenThresholdSeconds;
  const incidents: ComplianceIncident[] = [];
  let openStart: ParsedFireExitEvent | null = null;
  let activeIncident: ActiveIncidentState | null = null;

  for (const event of events) {
    if (isDoorOpenedEvent(event.eventType)) {
      openStart = event;
      activeIncident = null;
      continue;
    }

    if (isDoorClosedEvent(event.eventType)) {
      if (activeIncident && openStart) {
        incidents.push(
          finalizeActiveIncident(activeIncident, event, thresholdSeconds),
        );
      } else if (openStart) {
        const durationSeconds =
          (event.timestamp - openStart.timestamp) / 1000;

        if (durationSeconds > thresholdSeconds) {
          incidents.push(
            buildIncident(
              event.door,
              openStart,
              event.timestamp,
              event.eventTime,
              thresholdSeconds,
              "Held open (threshold exceeded)",
              false,
            ),
          );
        }
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
      };

      incidents.push(
        buildIncident(
          event.door,
          syntheticOpen,
          event.timestamp,
          event.eventTime,
          thresholdSeconds,
          event.eventType,
          true,
        ),
      );
    }
  }

  return incidents;
}
