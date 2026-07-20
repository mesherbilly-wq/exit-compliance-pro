export type IncidentClassification =
  | "native_held_open_alarm"
  | "derived_open_duration"
  | "derived_threshold_exceeded";

export const DERIVED_THRESHOLD_EXCEEDED_LABEL =
  "Open beyond configured threshold";

export const LEGACY_DERIVED_THRESHOLD_LABEL = "Held open (threshold exceeded)";

export function isNativeHeldOpenClassification(
  classification: IncidentClassification,
): boolean {
  return classification === "native_held_open_alarm";
}

export function classificationFromExplicitAlarm(
  isExplicitAlarm: boolean,
): IncidentClassification {
  return isExplicitAlarm
    ? "native_held_open_alarm"
    : "derived_open_duration";
}

export function getIncidentDisplayLabel(
  classification: IncidentClassification,
  nativeEventType?: string,
): string {
  if (classification === "native_held_open_alarm") {
    return nativeEventType?.trim() || "Held open alarm";
  }

  return DERIVED_THRESHOLD_EXCEEDED_LABEL;
}

export function normalizeIncidentClassification(
  incident: {
    classification?: IncidentClassification;
    isExplicitAlarm?: boolean;
    eventType?: string;
  },
): IncidentClassification {
  if (incident.classification) {
    return incident.classification;
  }

  if (incident.isExplicitAlarm) {
    return "native_held_open_alarm";
  }

  if (
    incident.eventType === LEGACY_DERIVED_THRESHOLD_LABEL ||
    incident.eventType === DERIVED_THRESHOLD_EXCEEDED_LABEL
  ) {
    return incident.classification === "derived_threshold_exceeded"
      ? "derived_threshold_exceeded"
      : "derived_open_duration";
  }

  if (incident.classification === "derived_threshold_exceeded") {
    return "derived_threshold_exceeded";
  }

  return incident.isExplicitAlarm
    ? "native_held_open_alarm"
    : "derived_open_duration";
}

export function normalizeIncidentEventType(incident: {
  classification?: IncidentClassification;
  isExplicitAlarm?: boolean;
  eventType?: string;
}): string {
  const classification = normalizeIncidentClassification(incident);
  return getIncidentDisplayLabel(classification, incident.eventType);
}
