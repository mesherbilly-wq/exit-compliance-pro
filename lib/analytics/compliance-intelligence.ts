import type {
  DistributionBucket,
  DoorIntelligenceProfile,
  FireExitIntelligenceReport,
} from "./types";
import {
  buildDoorIntelligenceRows,
  getTopHighestRiskDoors,
  getTopImprovingDoors,
  getTopDeterioratingDoors,
  type RiskRating,
} from "./door-intelligence-view";
import { getDoorIncidents, normalizeIntelligenceReport } from "./normalize-intelligence";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";

export type ComplianceRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  message: string;
  door?: string;
};

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

function formatHourLabel(hourLabel: string): string {
  if (hourLabel === "N/A") {
    return hourLabel;
  }

  const hour = Number.parseInt(hourLabel.split(":")[0] ?? "0", 10);
  if (hour >= 11 && hour <= 14) {
    return `${hourLabel} (lunchtime window)`;
  }

  return hourLabel;
}

function getDoorPeakHour(profile: DoorIntelligenceProfile): string | null {
  const peak = [...profile.timeOfDayDistribution]
    .filter((bucket) => bucket.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  return peak?.label ?? null;
}

function buildDoorSpecificRecommendations(
  profile: DoorIntelligenceProfile,
): ComplianceRecommendation[] {
  const recommendations: ComplianceRecommendation[] = [];
  const door = profile.door;
  const lower = door.toLowerCase();
  const peakHour = getDoorPeakHour(profile);

  if (lower.includes("loading") || lower.includes("bay") || lower.includes("rear")) {
    recommendations.push({
      id: `${door}-deliveries`,
      priority: "high",
      message: `Review deliveries at ${door}.`,
      door,
    });
  }

  if (lower.includes("kitchen")) {
    recommendations.push({
      id: `${door}-kitchen`,
      priority: "high",
      message: peakHour
        ? `Investigate ${door} behaviour during the ${formatHourLabel(peakHour)} peak.`
        : `Investigate ${door} lunchtime behaviour.`,
      door,
    });
  }

  if (lower.includes("plant room") || lower.includes("plant")) {
    recommendations.push({
      id: `${door}-plant`,
      priority: "medium",
      message: `Monitor ${door} for repeat held-open exposure.`,
      door,
    });
  }

  if (profile.repeatOccurrences >= 2) {
    recommendations.push({
      id: `${door}-repeat`,
      priority: "medium",
      message: `Review repeat held-open behaviour at ${door} (${profile.repeatOccurrences} repeat occurrences).`,
      door,
    });
  }

  return recommendations;
}

function generateRecommendations(
  report: FireExitIntelligenceReport,
): ComplianceRecommendation[] {
  const rows = buildDoorIntelligenceRows(report.doors);
  const recommendations: ComplianceRecommendation[] = [];
  const seen = new Set<string>();

  function add(recommendation: ComplianceRecommendation) {
    const key = recommendation.message.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    recommendations.push(recommendation);
  }

  const highestRisk = getTopHighestRiskDoors(rows, 1)[0];
  if (highestRisk) {
    add({
      id: "highest-risk",
      priority: "high",
      message: `Prioritise review of ${highestRisk.door} — highest portfolio risk with ${highestRisk.totalExposureLabel} time beyond threshold.`,
      door: highestRisk.door,
    });
  }

  const mostImproved = getTopImprovingDoors(rows, 1)[0];
  if (mostImproved) {
    add({
      id: "most-improved",
      priority: "low",
      message: `Maintain controls at ${mostImproved.door}; this exit is showing an improving trend.`,
      door: mostImproved.door,
    });
  }

  for (const deteriorating of getTopDeterioratingDoors(rows, 3)) {
    add({
      id: `${deteriorating.door}-deteriorating`,
      priority: "high",
      message: `Monitor ${deteriorating.door} — held-open trend is deteriorating.`,
      door: deteriorating.door,
    });
  }

  for (const profile of report.doors.filter(
    (door) => door.status === "Critical" || door.status === "Needs Attention",
  )) {
    for (const recommendation of buildDoorSpecificRecommendations(profile)) {
      add(recommendation);
    }
  }

  const timeBuckets = aggregateDistribution(report.doors, "timeOfDayDistribution");
  const dayBuckets = aggregateDistribution(report.doors, "dayOfWeekDistribution");
  const peakTime = getMostCommonBucket(timeBuckets);
  const peakDay = getMostCommonBucket(dayBuckets);

  if (peakTime !== "N/A") {
    add({
      id: "peak-time",
      priority: "medium",
      message: `Increase fire exit checks during the ${formatHourLabel(peakTime)} peak held-open window.`,
    });
  }

  if (peakDay !== "N/A") {
    add({
      id: "peak-day",
      priority: "medium",
      message: `Review operational controls on ${peakDay}, the most common day for held-open incidents.`,
    });
  }

  if (recommendations.length === 0) {
    add({
      id: "all-clear",
      priority: "low",
      message: "No immediate fire exit compliance actions required. Continue routine monitoring.",
    });
  }

  return recommendations.slice(0, 8);
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
    recommendations: generateRecommendations(normalized),
    intelligence: normalized,
  };
}
