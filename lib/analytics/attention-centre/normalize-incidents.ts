import type { ComplianceIncident, DoorIntelligenceProfile } from "@/lib/analytics/types";
import type {
  AttentionSourceSystem,
  NormalizedAttentionIncident,
} from "./types";

export function normalizeAttentionIncidents(
  incidents: ComplianceIncident[],
  doorBuildingMap: Map<string, string>,
  sourceSystem: AttentionSourceSystem = "genetec",
): NormalizedAttentionIncident[] {
  return incidents.map((incident) => ({
    ...incident,
    building: doorBuildingMap.get(incident.door) ?? "Unassigned",
    sourceSystem,
  }));
}

export function collectNormalizedIncidentsFromDoors(
  doors: DoorIntelligenceProfile[],
  getIncidents: (door: DoorIntelligenceProfile) => ComplianceIncident[],
  doorBuildingMap: Map<string, string>,
  sourceSystem: AttentionSourceSystem = "genetec",
): NormalizedAttentionIncident[] {
  const allIncidents: ComplianceIncident[] = [];

  for (const door of doors) {
    allIncidents.push(...getIncidents(door));
  }

  return normalizeAttentionIncidents(allIncidents, doorBuildingMap, sourceSystem);
}

export function detectAttentionSourceSystem(
  sourceFileName: string,
): AttentionSourceSystem {
  const normalized = sourceFileName.toLowerCase();

  if (normalized.includes("ajax")) {
    return "ajax";
  }

  if (normalized.includes("paxton")) {
    return "paxton";
  }

  if (normalized.includes("gallagher")) {
    return "gallagher";
  }

  if (normalized.includes("genetec") || normalized.includes(".csv")) {
    return "genetec";
  }

  return "unknown";
}
