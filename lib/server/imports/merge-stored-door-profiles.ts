import { attachComplianceProfilesToReport } from "@/lib/analytics/door-compliance-profile";
import { normalizeIntelligenceReport } from "@/lib/analytics/normalize-intelligence";
import { dedupeIncidents } from "@/lib/analytics/dedupe-parsed-events";
import { filterIncidentsByRetention } from "@/lib/analytics/import-data-retention";
import { groupEventsByDoor } from "@/lib/analytics/parse-events";
import { buildDoorIntelligenceProfile } from "@/lib/analytics/scoring";
import type {
  ComplianceIncident,
  DoorIntelligenceProfile,
  FireExitAnalyticsConfig,
  FireExitIntelligenceReport,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import type { FieldMapping } from "@/lib/imports/types";

export function mergeDoorProfilesByName(
  profiles: DoorIntelligenceProfile[],
): DoorIntelligenceProfile[] {
  const grouped = new Map<string, DoorIntelligenceProfile[]>();

  for (const profile of profiles) {
    const bucket = grouped.get(profile.door) ?? [];
    bucket.push(profile);
    grouped.set(profile.door, bucket);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([door, doorProfiles]) => {
      const incidents = dedupeIncidents(
        doorProfiles.flatMap(
          (profile) => profile.incidents ?? profile.sessions ?? [],
        ),
      );
      const totalFireExitEvents = doorProfiles.reduce(
        (sum, profile) => sum + profile.totalFireExitEvents,
        0,
      );

      return buildDoorIntelligenceProfile(
        door,
        totalFireExitEvents,
        incidents,
      );
    });
}

export function rebuildStoredProfilesForRetention(input: {
  profiles: DoorIntelligenceProfile[];
  eventsByImportId: Map<string, ParsedFireExitEvent[]>;
  config: FireExitAnalyticsConfig;
}): DoorIntelligenceProfile[] {
  const groupedEvents = groupEventsByDoor(
    [...input.eventsByImportId.values()].flat(),
  );
  const incidentsByDoor = new Map<string, ComplianceIncident[]>();

  for (const profile of input.profiles) {
    const filteredIncidents = filterIncidentsByRetention(
      profile.incidents ?? profile.sessions ?? [],
      input.config,
    );

    if (filteredIncidents.length === 0) {
      continue;
    }

    const existing = incidentsByDoor.get(profile.door) ?? [];
    incidentsByDoor.set(
      profile.door,
      dedupeIncidents([...existing, ...filteredIncidents]),
    );
  }

  const doorNames = new Set<string>([
    ...groupedEvents.keys(),
    ...incidentsByDoor.keys(),
  ]);

  return [...doorNames]
    .sort((left, right) => left.localeCompare(right))
    .map((door) =>
      buildDoorIntelligenceProfile(
        door,
        groupedEvents.get(door)?.length ?? 0,
        incidentsByDoor.get(door) ?? [],
      ),
    )
    .filter((door) => door.totalIncidents > 0 || door.totalFireExitEvents > 0);
}

export function buildIntelligenceReportFromDoorProfiles(input: {
  doors: DoorIntelligenceProfile[];
  config: FireExitAnalyticsConfig;
  mapping: FieldMapping;
  sourceFileName: string;
  analyzedRowCount: number;
  hasDurationField: boolean;
  analyzedAt?: string;
}): FireExitIntelligenceReport {
  const doors = mergeDoorProfilesByName(input.doors);
  const totalFireExitEvents = doors.reduce(
    (sum, door) => sum + door.totalFireExitEvents,
    0,
  );
  const totalHeldOpenEvents = doors.reduce(
    (sum, door) => sum + door.totalIncidents,
    0,
  );
  const totalExposureSeconds = doors.reduce(
    (sum, door) => sum + door.totalExposureSeconds,
    0,
  );
  const overallComplianceScore =
    doors.length > 0
      ? Math.round(
          doors.reduce((sum, door) => sum + door.complianceScore, 0) /
            doors.length,
        )
      : 100;

  return normalizeIntelligenceReport(
    attachComplianceProfilesToReport({
      config: input.config,
      mapping: input.mapping,
      sourceFileName: input.sourceFileName,
      analyzedRowCount: input.analyzedRowCount,
      analyzedAt: input.analyzedAt ?? new Date().toISOString(),
      doors,
      summary: {
        totalDoors: doors.length,
        doorsWithViolations: doors.filter((door) => door.totalIncidents > 0)
          .length,
        totalFireExitEvents,
        totalHeldOpenEvents,
        totalExposureSeconds,
        totalExposureLabel: formatExposureLabel(totalExposureSeconds),
        overallComplianceScore,
        excellentDoors: doors.filter((door) => door.status === "Excellent")
          .length,
        doorsNeedingAttention: doors.filter(
          (door) => door.status === "Needs Attention",
        ).length,
        criticalDoors: doors.filter((door) => door.status === "Critical")
          .length,
        worstDoor:
          [...doors].sort(
            (left, right) => left.complianceScore - right.complianceScore,
          )[0]?.door ?? "N/A",
        hasDurationField: input.hasDurationField,
      },
    }),
  );
}

function formatExposureLabel(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
