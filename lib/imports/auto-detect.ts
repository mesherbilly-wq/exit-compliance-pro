import type { FieldMapping, GenetecFieldKey } from "./types";

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_-]+/g, " ");
}

const AUTO_DETECT_PATTERNS: Record<GenetecFieldKey, string[]> = {
  eventTime: [
    "event time",
    "event timestamp",
    "timestamp",
    "time",
    "datetime",
    "date time",
    "occurrence time",
    "occurred",
    "when",
  ],
  eventType: [
    "event type",
    "event name",
    "event",
    "type",
    "description",
    "activity",
    "alarm",
  ],
  doorName: [
    "door name",
    "door",
    "access point",
    "entity",
    "device name",
    "device",
    "reader",
    "input",
  ],
  cardholderName: [
    "cardholder name",
    "cardholder",
    "person name",
    "full name",
    "name",
    "user name",
    "employee name",
  ],
  cardholderEmail: [
    "cardholder email",
    "email",
    "e-mail",
    "mail",
    "user email",
  ],
  credentialNumber: [
    "credential number",
    "card number",
    "card no",
    "card #",
    "credential",
    "badge number",
    "badge",
    "card id",
  ],
  accessResult: [
    "access result",
    "result",
    "outcome",
    "access granted",
    "grant",
    "status",
    "decision",
  ],
  siteBuilding: [
    "site",
    "building",
    "location",
    "area",
    "partition",
    "facility",
    "site name",
  ],
};

function scoreHeader(header: string, patterns: string[]): number {
  const normalized = normalizeHeader(header);

  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];

    if (normalized === pattern) {
      return 100 - index;
    }

    if (normalized.includes(pattern) || pattern.includes(normalized)) {
      return 50 - index;
    }
  }

  return 0;
}

export function autoDetectFieldMapping(headers: string[]): FieldMapping {
  const usedHeaders = new Set<string>();
  const mapping = {} as FieldMapping;

  const fieldKeys = Object.keys(AUTO_DETECT_PATTERNS) as GenetecFieldKey[];

  for (const fieldKey of fieldKeys) {
    const patterns = AUTO_DETECT_PATTERNS[fieldKey];

    const bestMatch = headers
      .filter((header) => !usedHeaders.has(header))
      .map((header) => ({
        header,
        score: scoreHeader(header, patterns),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    mapping[fieldKey] = bestMatch?.header ?? "";
    if (bestMatch) {
      usedHeaders.add(bestMatch.header);
    }
  }

  return mapping;
}

export function createEmptyFieldMapping(): FieldMapping {
  return {
    eventTime: "",
    eventType: "",
    doorName: "",
    cardholderName: "",
    cardholderEmail: "",
    credentialNumber: "",
    accessResult: "",
    siteBuilding: "",
  };
}
