import type { ComplianceIncident, DoorIntelligenceProfile } from "./types";
import {
  buildDoorComplianceProfile,
  calculateExposureComplianceScore,
  toDoorIntelligenceProfile,
} from "./door-compliance-profile";

export { calculateExposureComplianceScore };

export function buildDoorIntelligenceProfile(
  door: string,
  totalFireExitEvents: number,
  incidents: ComplianceIncident[],
): DoorIntelligenceProfile {
  const complianceProfile = buildDoorComplianceProfile(
    door,
    totalFireExitEvents,
    incidents,
  );

  return toDoorIntelligenceProfile(complianceProfile);
}
