import type {
  DistributionBucket,
  DoorIntelligenceProfile,
  FireExitIntelligenceReport,
} from "./types";
import {
  buildDoorIntelligenceRows,
  getTopHighestRiskDoors,
  getTopImprovingDoors,
  type RiskRating,
} from "./door-intelligence-view";
import { getDoorIncidents, normalizeIntelligenceReport } from "./normalize-intelligence";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import {
  generateComplianceRecommendations,
  type ComplianceRecommendation,
} from "./compliance-recommendations";

export type { ComplianceRecommendation } from "./compliance-recommendations";

export type ComplianceIntelligenceDashboard = {
  sourceFileName: string;
  overallComplianceScore: number;
  riskLevel: RiskRating;
  totalDoors: number;
  healthyDoors: number;
  doorsRequiringAttention: number;
  criticalDoors: number;
  totalExposureLabel: string;
  totalExposureSeconds: number;
  averageExposurePerDoorLabel: string;
  longestSingleIncidentLabel: string;
  longestSingleIncidentDoor: string;
  mostImprovedDoor: string;
  highestRiskDoor: string;
  mostCommonTimeOfDay: string;
  mostCommonDayOfWeek: string;
  recommendations: ComplianceRecommendation[];
  intelligence: FireExitIntelligenceReport;
};

function getPortfolioRiskLevel(
  score: number,
  totalExposureSeconds: number,
  doorsWithViolations: number,
): RiskRating {
  if (doorsWithViolations === 0) {
    return "Low";
  }

  if (score >= 85 && totalExposureSeconds < 300) {
    return "Low";
  }

  if (score >= 70) {
    return "Medium";
  }

  if (score >= 50) {
    return "High";
  }

  return "Critical";
}

function aggregateDistribution(
  doors: DoorIntelligenceProfile[],
  key: "timeOfDayDistribution" | "dayOfWeekDistribution",
): DistributionBucket[] {
  const aggregated = new Map<string, DistributionBucket>();

  for (const door of doors) {
    for (const bucket of door[key]) {
      const existing = aggregated.get(bucket.label) ?? {
        label: bucket.label,
        count: 0,
        exposureSeconds: 0,
      };

      existing.count += bucket.count;
      existing.exposureSeconds += bucket.exposureSeconds;
      aggregated.set(bucket.label, existing);
    }
  }

  return [...aggregated.values()];
}

function getMostCommonBucket(buckets: DistributionBucket[]): string {
  const top = [...buckets]
    .filter((bucket) => bucket.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  return top?.label ?? "N/A";
}

export function buildComplianceIntelligenceDashboard(
  report: FireExitIntelligenceReport,
): ComplianceIntelligenceDashboard {
  const normalized = normalizeIntelligenceReport(report);
  const rows = buildDoorIntelligenceRows(normalized.doors);
  const summary = normalized.summary;

  const healthyDoors = normalized.doors.filter(
    (door) => door.status === "Excellent" || door.status === "Good",
  ).length;

  const doorsRequiringAttention = normalized.doors.filter(
    (door) => door.status === "Needs Attention",
  ).length;

  const averageExposureSeconds =
    summary.totalDoors > 0
      ? summary.totalExposureSeconds / summary.totalDoors
      : 0;

  let longestSingleIncidentSeconds = 0;
  let longestSingleIncidentDoor = "N/A";

  for (const door of normalized.doors) {
    for (const incident of getDoorIncidents(door)) {
      if (incident.durationSeconds > longestSingleIncidentSeconds) {
        longestSingleIncidentSeconds = incident.durationSeconds;
        longestSingleIncidentDoor = door.door;
      }
    }
  }

  const mostImproved = getTopImprovingDoors(rows, 1)[0]?.door ?? "N/A";
  const highestRisk = getTopHighestRiskDoors(rows, 1)[0]?.door ?? summary.worstDoor;

  const timeBuckets = aggregateDistribution(normalized.doors, "timeOfDayDistribution");
  const dayBuckets = aggregateDistribution(normalized.doors, "dayOfWeekDistribution");

  return {
    sourceFileName: normalized.sourceFileName,
    overallComplianceScore: summary.overallComplianceScore,
    riskLevel: getPortfolioRiskLevel(
      summary.overallComplianceScore,
      summary.totalExposureSeconds,
      summary.doorsWithViolations,
    ),
    totalDoors: summary.totalDoors,
    healthyDoors,
    doorsRequiringAttention,
    criticalDoors: summary.criticalDoors,
    totalExposureLabel: summary.totalExposureLabel,
    totalExposureSeconds: summary.totalExposureSeconds,
    averageExposurePerDoorLabel: formatDurationLabel(averageExposureSeconds),
    longestSingleIncidentLabel: formatDurationLabel(
      longestSingleIncidentSeconds > 0 ? longestSingleIncidentSeconds : null,
    ),
    longestSingleIncidentDoor,
    mostImprovedDoor: mostImproved,
    highestRiskDoor: highestRisk,
    mostCommonTimeOfDay: getMostCommonBucket(timeBuckets),
    mostCommonDayOfWeek: getMostCommonBucket(dayBuckets),
    recommendations: generateComplianceRecommendations(normalized),
    intelligence: normalized,
  };
}
