import {
  getIncidentDurationBucket,
  getIncidentRiskRating,
} from "./compliance-incidents";
import {
  normalizeIncidentClassification,
  normalizeIncidentEventType,
} from "./incident-classification";
import {
  attachComplianceProfilesToReport,
  buildDoorComplianceProfile,
} from "./door-compliance-profile";
import type {
  ComplianceIncident,
  DoorIntelligenceProfile,
  FireExitIntelligenceReport,
} from "./types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type LegacySession = Partial<ComplianceIncident> & {
  exposureSeconds?: number;
};

function normalizeLegacySession(
  session: LegacySession,
  door: DoorIntelligenceProfile,
  thresholdSeconds: number,
): ComplianceIncident {
  const durationSeconds = session.durationSeconds ?? 0;
  const timeBeyondThresholdSeconds =
    session.timeBeyondThresholdSeconds ??
    session.exposureSeconds ??
    Math.max(0, durationSeconds - thresholdSeconds);
  const startTimestamp = session.startTimestamp ?? 0;
  const startDate = new Date(startTimestamp);

  return {
    door: session.door ?? door.door,
    startTimestamp,
    endTimestamp: session.endTimestamp ?? startTimestamp,
    startTimeLabel: session.startTimeLabel ?? "N/A",
    endTimeLabel: session.endTimeLabel ?? "N/A",
    durationSeconds,
    thresholdSeconds: session.thresholdSeconds ?? thresholdSeconds,
    timeBeyondThresholdSeconds,
    riskRating:
      session.riskRating ??
      getIncidentRiskRating(timeBeyondThresholdSeconds, durationSeconds),
    durationBucket:
      session.durationBucket ??
      getIncidentDurationBucket(timeBeyondThresholdSeconds),
    dayStarted: session.dayStarted ?? DAY_LABELS[startDate.getDay()] ?? "N/A",
    hourStarted: session.hourStarted ?? startDate.getHours(),
    isExplicitAlarm: session.isExplicitAlarm ?? false,
    classification: normalizeIncidentClassification({
      classification: session.classification,
      isExplicitAlarm: session.isExplicitAlarm,
      eventType: session.eventType,
    }),
    eventType: normalizeIncidentEventType({
      classification: session.classification,
      isExplicitAlarm: session.isExplicitAlarm,
      eventType: session.eventType,
    }),
  };
}

export function getDoorIncidents(
  door: DoorIntelligenceProfile,
  thresholdSeconds = 30,
): ComplianceIncident[] {
  const legacySessions = door.sessions as LegacySession[] | undefined;

  if (Array.isArray(door.incidents) && door.incidents.length > 0) {
    return door.incidents.map((incident) =>
      incident.timeBeyondThresholdSeconds !== undefined
        ? incident
        : normalizeLegacySession(incident, door, thresholdSeconds),
    );
  }

  if (Array.isArray(legacySessions) && legacySessions.length > 0) {
    return legacySessions.map((session) =>
      normalizeLegacySession(session, door, thresholdSeconds),
    );
  }

  return door.incidents ?? [];
}

export function normalizeDoorProfile(
  door: DoorIntelligenceProfile,
  thresholdSeconds: number,
): DoorIntelligenceProfile {
  const incidents = getDoorIncidents(door, thresholdSeconds);
  const totalIncidents =
    door.totalIncidents ?? door.totalHeldOpenEvents ?? incidents.length;

  const normalized = {
    ...door,
    incidents,
    sessions: incidents,
    totalIncidents,
    totalHeldOpenEvents: totalIncidents,
  };

  if (normalized.complianceProfile) {
    return normalized;
  }

  const complianceProfile = buildDoorComplianceProfile(
    door.door,
    door.totalFireExitEvents,
    incidents,
  );

  return {
    ...normalized,
    complianceProfile,
  };
}

export function normalizeIntelligenceReport(
  report: FireExitIntelligenceReport,
): FireExitIntelligenceReport {
  const thresholdSeconds = report.config?.heldOpenThresholdSeconds ?? 30;
  const doors = report.doors.map((door) =>
    normalizeDoorProfile(door, thresholdSeconds),
  );

  const totalHeldOpenEvents = doors.reduce(
    (sum, door) => sum + door.totalIncidents,
    0,
  );

  return attachComplianceProfilesToReport({
    ...report,
    doors,
    summary: {
      ...report.summary,
      totalHeldOpenEvents:
        report.summary.totalHeldOpenEvents ?? totalHeldOpenEvents,
    },
  });
}
