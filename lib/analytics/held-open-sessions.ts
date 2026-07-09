import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "@/lib/reports/door-event-analysis";
import { isHeldOpenEvent } from "@/lib/reports/held-open-detection";
import type { FireExitAnalyticsConfig, HeldOpenSession, ParsedFireExitEvent } from "./types";

function createSession(
  door: string,
  start: ParsedFireExitEvent,
  endTimestamp: number,
  endTimeLabel: string,
  durationSeconds: number,
  thresholdSeconds: number,
  isExplicitAlarm: boolean,
  eventType: string,
): HeldOpenSession {
  const exposureSeconds = Math.max(0, durationSeconds - thresholdSeconds);

  return {
    door,
    startTimestamp: start.timestamp,
    endTimestamp,
    startTimeLabel: start.eventTime,
    endTimeLabel,
    durationSeconds,
    exposureSeconds: Math.max(0, durationSeconds - thresholdSeconds),
    isExplicitAlarm,
    eventType,
  };
}

export function buildHeldOpenSessions(
  events: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
): HeldOpenSession[] {
  const thresholdSeconds = config.heldOpenThresholdSeconds;
  const sessions: HeldOpenSession[] = [];
  let openStart: ParsedFireExitEvent | null = null;
  let activeSession: HeldOpenSession | null = null;

  for (const event of events) {
    if (isDoorOpenedEvent(event.eventType)) {
      openStart = event;
      activeSession = null;
      continue;
    }

    if (isDoorClosedEvent(event.eventType) && openStart) {
      const durationSeconds = (event.timestamp - openStart.timestamp) / 1000;

      if (durationSeconds > thresholdSeconds && !activeSession) {
        sessions.push(
          createSession(
            event.door,
            openStart,
            event.timestamp,
            event.eventTime,
            durationSeconds,
            thresholdSeconds,
            false,
            "Held open (threshold exceeded)",
          ),
        );
      } else if (activeSession) {
        activeSession.endTimestamp = event.timestamp;
        activeSession.endTimeLabel = event.eventTime;
        activeSession.durationSeconds = durationSeconds;
        activeSession.exposureSeconds = Math.max(
          0,
          durationSeconds - thresholdSeconds,
        );
      }

      openStart = null;
      activeSession = null;
      continue;
    }

    if (isHeldOpenEvent(event.eventType)) {
      const inferredDuration =
        event.csvDurationSeconds ??
        (openStart
          ? (event.timestamp - openStart.timestamp) / 1000
          : thresholdSeconds);

      const durationSeconds = Math.max(inferredDuration, thresholdSeconds);
      const qualifies =
        durationSeconds > thresholdSeconds || isHeldOpenEvent(event.eventType);

      if (qualifies && !activeSession && openStart) {
        const session = createSession(
          event.door,
          openStart,
          event.timestamp,
          event.eventTime,
          durationSeconds,
          thresholdSeconds,
          true,
          event.eventType,
        );
        sessions.push(session);
        activeSession = session;
      }
    }
  }

  return sessions;
}
