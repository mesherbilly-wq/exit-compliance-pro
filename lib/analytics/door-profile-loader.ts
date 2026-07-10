import { getLatestImport } from "@/lib/imports/storage";
import type { ImportRecord } from "@/lib/imports/types";
import { getDoorRecommendations } from "./compliance-recommendations";
import type { ComplianceRecommendation } from "./compliance-recommendations";
import {
  getDoorComplianceProfiles,
  toDoorIntelligenceProfile,
} from "./door-compliance-profile";
import { getRiskRating } from "./door-intelligence-view";
import { normalizeIntelligenceReport } from "./normalize-intelligence";
import type {
  DoorComplianceProfile,
  FireExitIntelligenceReport,
  RiskRating,
} from "./types";

export type DoorProfileData = {
  importRecord: ImportRecord | null;
  profile: DoorComplianceProfile | null;
  riskRating: RiskRating | null;
  thresholdSeconds: number | null;
  recommendations: ComplianceRecommendation[];
  report: FireExitIntelligenceReport | null;
};

export function loadDoorProfile(doorName: string): DoorProfileData {
  const importRecord = getLatestImport();
  const empty: DoorProfileData = {
    importRecord,
    profile: null,
    riskRating: null,
    thresholdSeconds: null,
    recommendations: [],
    report: null,
  };

  if (!importRecord?.analysisSnapshot?.intelligence) {
    return empty;
  }

  const report = normalizeIntelligenceReport(
    importRecord.analysisSnapshot.intelligence,
  );
  const profile =
    getDoorComplianceProfiles(report).find((item) => item.door === doorName) ??
    null;

  if (!profile) {
    return { ...empty, report };
  }

  const riskRating = getRiskRating(toDoorIntelligenceProfile(profile));
  const thresholdSeconds =
    report.config?.heldOpenThresholdSeconds ??
    profile.incidents[0]?.thresholdSeconds ??
    null;

  return {
    importRecord,
    profile,
    riskRating,
    thresholdSeconds,
    recommendations: getDoorRecommendations(report, doorName),
    report,
  };
}
