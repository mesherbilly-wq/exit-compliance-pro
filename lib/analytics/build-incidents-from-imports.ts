import { buildComplianceIncidents } from "./compliance-incidents";
import { dedupeIncidents, dedupeParsedEvents } from "./dedupe-parsed-events";
import { groupEventsByDoor } from "./parse-events";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  ParsedFireExitEvent,
} from "./types";

export function buildIncidentsByDoorFromImportGroups(
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
  config: FireExitAnalyticsConfig,
): Map<string, ComplianceIncident[]> {
  const incidentsByDoor = new Map<string, ComplianceIncident[]>();

  for (const importEvents of eventsByImportId.values()) {
    const grouped = groupEventsByDoor(importEvents);

    for (const [door, doorEvents] of grouped) {
      const importIncidents = buildComplianceIncidents(doorEvents, config);
      if (importIncidents.length === 0) {
        continue;
      }

      const existing = incidentsByDoor.get(door) ?? [];
      incidentsByDoor.set(door, dedupeIncidents([...existing, ...importIncidents]));
    }
  }

  return incidentsByDoor;
}

export function buildDedupedEventsFromImportGroups(
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
): ParsedFireExitEvent[] {
  return dedupeParsedEvents([...eventsByImportId.values()].flat());
}
