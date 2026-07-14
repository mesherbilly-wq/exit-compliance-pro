import {
  generateComplianceRecommendations,
  type ComplianceRecommendation,
} from "@/lib/analytics/compliance-recommendations";
import {
  buildDayOfWeekDistribution,
  buildWeeklyTrend,
  countRepeatOccurrences,
} from "@/lib/analytics/distributions";
import {
  buildDoorIntelligenceRows,
  getRiskRating,
  getTrendDirection,
} from "@/lib/analytics/door-intelligence-view";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";
import { getDoorIncidents } from "@/lib/analytics/normalize-intelligence";
import { getDoorProfileHref } from "@/lib/doors/door-routes";
import type { RiskRating } from "@/lib/analytics/types";
import type {
  AttentionCentreBuildInput,
  AttentionCentreDashboard,
  AttentionCentreFilterOptions,
  AttentionCentreFilters,
  AttentionCriticalItem,
  AttentionImprovementItem,
  AttentionInvestigationItem,
  AttentionRecommendationCard,
  AttentionRecommendationGroups,
  AttentionRecommendationTier,
  NormalizedAttentionIncident,
} from "./types";

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function countIncidentsOnDate(
  incidents: NormalizedAttentionIncident[],
  dayKey: string,
): number {
  return incidents.filter((incident) => dateKey(incident.startTimestamp) === dayKey)
    .length;
}

function countIncidentsToday(
  incidents: NormalizedAttentionIncident[],
  referenceMs: number,
): number {
  return countIncidentsOnDate(incidents, dateKey(referenceMs));
}

function getBuildingForDoor(
  door: string,
  incidents: NormalizedAttentionIncident[],
  doorBuildingMap: Map<string, string>,
): string {
  return (
    incidents.find((incident) => incident.door === door)?.building ??
    doorBuildingMap.get(door) ??
    "Unassigned"
  );
}

function buildCriticalItems(input: AttentionCentreBuildInput): AttentionCriticalItem[] {
  const {
    report,
    normalizedIncidents,
    doorBuildingMap,
    config,
    referenceMs = Date.now(),
  } = input;
  const items: AttentionCriticalItem[] = [];
  const seen = new Set<string>();
  const criticalHeldOpenSeconds = config.criticalHeldOpenMinutes * 60;
  const rows = buildDoorIntelligenceRows(report.doors);

  for (const row of rows) {
    const doorProfile = report.doors.find((door) => door.door === row.door);
    if (!doorProfile) {
      continue;
    }

    const incidents = normalizedIncidents.filter(
      (incident) => incident.door === row.door,
    );
    const building = getBuildingForDoor(row.door, incidents, doorBuildingMap);
    const sourceSystem = incidents[0]?.sourceSystem ?? "genetec";
    const risk = getRiskRating(doorProfile);

    const longestIncident = [...incidents].sort(
      (a, b) => b.durationSeconds - a.durationSeconds,
    )[0];

    if (
      longestIncident &&
      longestIncident.durationSeconds >= criticalHeldOpenSeconds
    ) {
      const id = `${row.door}-held-open-${longestIncident.startTimestamp}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          door: row.door,
          building,
          issue: `Door held open more than ${config.criticalHeldOpenMinutes} minutes`,
          currentRisk: risk,
          durationLabel: formatDurationLabel(longestIncident.durationSeconds),
          actionLabel: "Review door",
          actionHref: getDoorProfileHref(row.door),
          sourceSystem,
        });
      }
    }

    const repeatCount = countRepeatOccurrences(
      incidents.map(({ building: _building, sourceSystem: _source, ...incident }) => incident),
    );

    if (repeatCount >= 2) {
      const id = `${row.door}-repeat-threshold`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          door: row.door,
          building,
          issue: "Door repeatedly exceeding threshold",
          currentRisk: risk,
          durationLabel: `${repeatCount} repeat occurrences`,
          actionLabel: "Review door",
          actionHref: getDoorProfileHref(row.door),
          sourceSystem,
        });
      }
    }

    if (
      row.complianceScore < config.criticalComplianceScoreThreshold &&
      row.occurrences > 0
    ) {
      const id = `${row.door}-low-compliance`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          door: row.door,
          building,
          issue: `Compliance score below ${config.criticalComplianceScoreThreshold}%`,
          currentRisk: risk,
          durationLabel: `${row.complianceScore}% compliance`,
          actionLabel: "Review door",
          actionHref: getDoorProfileHref(row.door),
          sourceSystem,
        });
      }
    }

    if (risk === "Critical" && row.occurrences > 0) {
      const id = `${row.door}-critical-risk`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          door: row.door,
          building,
          issue: "Critical risk door requires immediate action",
          currentRisk: risk,
          durationLabel: row.totalExposureLabel,
          actionLabel: "Review door",
          actionHref: getDoorProfileHref(row.door),
          sourceSystem,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const riskOrder: Record<RiskRating, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1,
    };

    return riskOrder[b.currentRisk] - riskOrder[a.currentRisk];
  });
}

function buildInvestigationItems(
  input: AttentionCentreBuildInput,
): AttentionInvestigationItem[] {
  const {
    report,
    normalizedIncidents,
    doorBuildingMap,
    config,
    decliningDoors,
    comparisonAvailable,
    referenceMs = Date.now(),
  } = input;
  const items: AttentionInvestigationItem[] = [];
  const seen = new Set<string>();

  for (const doorProfile of report.doors) {
    const incidents = normalizedIncidents.filter(
      (incident) => incident.door === doorProfile.door,
    );

    if (incidents.length === 0) {
      continue;
    }

    const building = getBuildingForDoor(
      doorProfile.door,
      incidents,
      doorBuildingMap,
    );
    const sourceSystem = incidents[0]?.sourceSystem ?? "genetec";
    const plainIncidents = incidents.map(
      ({ building: _building, sourceSystem: _source, ...incident }) => incident,
    );

    const todayCount = countIncidentsToday(incidents, referenceMs);
    if (todayCount >= config.repeatIncidentsTodayThreshold) {
      const id = `${doorProfile.door}-today-repeat`;
      seen.add(id);
      items.push({
        id,
        door: doorProfile.door,
        building,
        pattern: `Same door triggered more than ${config.repeatIncidentsTodayThreshold} times today`,
        evidence: `${todayCount} incidents recorded today`,
        suggestedInvestigation: `Review staffing, access routines, and propping at ${doorProfile.door} during today's activity.`,
        investigateHref: getDoorProfileHref(doorProfile.door),
        sourceSystem,
      });
    }

    const dayDistribution = buildDayOfWeekDistribution(plainIncidents);
    const mondayCount = dayDistribution.find((bucket) => bucket.label === "Mon")?.count ?? 0;
    if (mondayCount >= 2 && mondayCount / incidents.length >= 0.4) {
      const id = `${doorProfile.door}-monday-pattern`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          door: doorProfile.door,
          building,
          pattern: "Same door triggered repeatedly on Mondays",
          evidence: `${mondayCount} of ${incidents.length} incidents occurred on Monday`,
          suggestedInvestigation: `Inspect Monday delivery or cleaning routines affecting ${doorProfile.door}.`,
          investigateHref: getDoorProfileHref(doorProfile.door),
          sourceSystem,
        });
      }
    }

    const weeklyTrend = buildWeeklyTrend(plainIncidents);
    if (weeklyTrend.length >= 2) {
      const midpoint = Math.floor(weeklyTrend.length / 2);
      const earlierExposure = weeklyTrend
        .slice(0, midpoint)
        .reduce((sum, point) => sum + point.exposureSeconds, 0);
      const recentExposure = weeklyTrend
        .slice(midpoint)
        .reduce((sum, point) => sum + point.exposureSeconds, 0);

      if (recentExposure > earlierExposure * 1.2 && recentExposure > 0) {
        const id = `${doorProfile.door}-tbt-increasing`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            door: doorProfile.door,
            building,
            pattern: "Time Beyond Threshold increasing week-on-week",
            evidence: `Recent weeks total ${formatDurationLabel(recentExposure)} vs earlier ${formatDurationLabel(earlierExposure)}`,
            suggestedInvestigation: `Trace recent workflow changes and held-open causes at ${doorProfile.door}.`,
            investigateHref: getDoorProfileHref(doorProfile.door),
            sourceSystem,
          });
        }
      }
    }
  }

  if (comparisonAvailable) {
    for (const declining of decliningDoors) {
      if ((declining.differencePoints ?? 0) >= 3) {
        const id = `${declining.door}-compliance-falling`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            door: declining.door,
            building: getBuildingForDoor(
              declining.door,
              normalizedIncidents,
              doorBuildingMap,
            ),
            pattern: "Compliance score falling over multiple periods",
            evidence: `Compliance declined by ${Math.abs(declining.differencePoints ?? 0)} percentage points vs previous period`,
            suggestedInvestigation: `Review repeat incidents and threshold exceedance at ${declining.door}.`,
            investigateHref: getDoorProfileHref(declining.door),
            sourceSystem:
              normalizedIncidents.find((incident) => incident.door === declining.door)
                ?.sourceSystem ?? "genetec",
          });
        }
      }
    }
  }

  return items;
}

function buildImprovementItems(
  input: AttentionCentreBuildInput,
): AttentionImprovementItem[] {
  const {
    report,
    normalizedIncidents,
    doorBuildingMap,
    config,
    improvingDoors,
    comparisonAvailable,
    referenceMs = Date.now(),
  } = input;
  const items: AttentionImprovementItem[] = [];
  const seen = new Set<string>();
  const topRiskDoors = new Set(
    buildDoorIntelligenceRows(report.doors)
      .filter((row) => row.riskRating === "Critical" || row.riskRating === "High")
      .map((row) => row.door),
  );

  if (comparisonAvailable) {
    for (const improving of improvingDoors) {
      if ((improving.differencePoints ?? 0) > 0) {
        const id = `${improving.door}-compliance-improved`;
        seen.add(id);
        items.push({
          id,
          door: improving.door,
          building: getBuildingForDoor(
            improving.door,
            normalizedIncidents,
            doorBuildingMap,
          ),
          improvement: "Compliance improved compared with previous period",
          impact: `Up ${improving.differencePoints} percentage points`,
          sourceSystem:
            normalizedIncidents.find((incident) => incident.door === improving.door)
              ?.sourceSystem ?? "genetec",
        });
      }
    }
  }

  for (const doorProfile of report.doors) {
    const incidents = normalizedIncidents.filter(
      (incident) => incident.door === doorProfile.door,
    );
    const plainIncidents = incidents.map(
      ({ building: _building, sourceSystem: _source, ...incident }) => incident,
    );

    const { trend } = getTrendDirection(doorProfile.weeklyTrend);

    if (trend === "Improving" && !seen.has(`${doorProfile.door}-trend-improving`)) {
      seen.add(`${doorProfile.door}-trend-improving`);
      items.push({
        id: `${doorProfile.door}-trend-improving`,
        door: doorProfile.door,
        building: getBuildingForDoor(doorProfile.door, incidents, doorBuildingMap),
        improvement: "Sustained improving compliance trend",
        impact: `${doorProfile.complianceScore}% compliance with improving weekly pattern`,
        sourceSystem: incidents[0]?.sourceSystem ?? "genetec",
      });
    }

    if (
      !topRiskDoors.has(doorProfile.door) &&
      doorProfile.complianceScore >= 85 &&
      doorProfile.totalIncidents > 0
    ) {
      const id = `${doorProfile.door}-no-longer-top-risk`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          door: doorProfile.door,
          building: getBuildingForDoor(doorProfile.door, incidents, doorBuildingMap),
          improvement: "Door no longer appears in top risks",
          impact: `${doorProfile.complianceScore}% compliance with manageable exposure`,
          sourceSystem: incidents[0]?.sourceSystem ?? "genetec",
        });
      }
    }

    const weeklyTrend = buildWeeklyTrend(plainIncidents);
    if (weeklyTrend.length >= 2) {
      const midpoint = Math.floor(weeklyTrend.length / 2);
      const earlierExposure = weeklyTrend
        .slice(0, midpoint)
        .reduce((sum, point) => sum + point.exposureSeconds, 0);
      const recentExposure = weeklyTrend
        .slice(midpoint)
        .reduce((sum, point) => sum + point.exposureSeconds, 0);

      if (earlierExposure > 0 && recentExposure < earlierExposure * 0.8) {
        const id = `${doorProfile.door}-tbt-reduced`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            door: doorProfile.door,
            building: getBuildingForDoor(doorProfile.door, incidents, doorBuildingMap),
            improvement: "Time Beyond Threshold reduced",
            impact: `Recent exposure ${formatDurationLabel(recentExposure)} vs earlier ${formatDurationLabel(earlierExposure)}`,
            sourceSystem: incidents[0]?.sourceSystem ?? "genetec",
          });
        }
      }
    }

    const lastIncident = plainIncidents.at(-1);
    if (lastIncident) {
      const daysSince =
        (referenceMs - lastIncident.startTimestamp) / (24 * 60 * 60 * 1000);

      if (daysSince >= config.incidentFreeDaysThreshold) {
        const id = `${doorProfile.door}-incident-free`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            door: doorProfile.door,
            building: getBuildingForDoor(doorProfile.door, incidents, doorBuildingMap),
            improvement: `No incidents for ${config.incidentFreeDaysThreshold} days`,
            impact: `${Math.floor(daysSince)} days since last recorded incident`,
            sourceSystem: incidents[0]?.sourceSystem ?? "genetec",
          });
        }
      }
    }
  }

  return items.slice(0, 15);
}

function getRecommendationTier(
  recommendation: ComplianceRecommendation,
): AttentionRecommendationTier {
  if (recommendation.priority === "low") {
    return "low";
  }

  if (recommendation.priority === "medium") {
    return "medium";
  }

  if (
    recommendation.category === "door_risk" ||
    recommendation.category === "incident_duration" ||
    recommendation.signals.includes("repeat_behaviour")
  ) {
    return "critical";
  }

  return "high";
}

function getExpectedBenefit(recommendation: ComplianceRecommendation): string {
  switch (recommendation.category) {
    case "time_pattern":
      return "Reducing repeat incidents during the identified time window.";
    case "weekly_pattern":
      return "Better control of recurring weekly compliance peaks.";
    case "repeat_behaviour":
      return "Lower repeat threshold exceedance and exposure time.";
    case "compliance_trend":
      return "Prevent further compliance deterioration at this door.";
    case "incident_duration":
      return "Reduced life safety exposure from extended held-open events.";
    case "door_risk":
      return "Prioritised remediation for the highest-risk exit points.";
    case "incident_free":
      return "Sustained incident-free performance and audit confidence.";
    case "portfolio":
      return "Improved portfolio-wide compliance and operational visibility.";
    default:
      return recommendation.message || recommendation.summary;
  }
}

function buildRecommendationGroups(
  input: AttentionCentreBuildInput,
): AttentionRecommendationGroups {
  const recommendations = generateComplianceRecommendations(input.report, 24);
  const groups: AttentionRecommendationGroups = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const recommendation of recommendations) {
    const tier = getRecommendationTier(recommendation);
    const door = recommendation.door ?? null;

    groups[tier].push({
      id: recommendation.id,
      tier,
      door,
      building: door
        ? getBuildingForDoor(door, input.normalizedIncidents, input.doorBuildingMap)
        : "Portfolio",
      title: recommendation.title,
      whyThisMatters: recommendation.summary,
      recommendedAction: recommendation.action,
      expectedBenefit: getExpectedBenefit(recommendation),
      sourceSystem:
        (door
          ? input.normalizedIncidents.find((incident) => incident.door === door)
              ?.sourceSystem
          : undefined) ?? "genetec",
    });
  }

  return groups;
}

export function buildFilterOptions(
  normalizedIncidents: NormalizedAttentionIncident[],
  doors: string[],
): AttentionCentreFilterOptions {
  const timestamps = normalizedIncidents.map((incident) => incident.startTimestamp);
  const buildings = [
    ...new Set(normalizedIncidents.map((incident) => incident.building)),
  ].sort((a, b) => a.localeCompare(b));
  const risks: RiskRating[] = ["Critical", "High", "Medium", "Low"];

  const min =
    timestamps.length > 0
      ? dateKey(Math.min(...timestamps))
      : dateKey(Date.now());
  const max =
    timestamps.length > 0
      ? dateKey(Math.max(...timestamps))
      : dateKey(Date.now());

  return {
    risks,
    doors: [...doors].sort((a, b) => a.localeCompare(b)),
    buildings,
    dateRange: { min, max },
  };
}

export function applyAttentionCentreFilters(
  dashboard: AttentionCentreDashboard,
  filters: AttentionCentreFilters,
): AttentionCentreDashboard {
  const matchesDoor = (door: string) =>
    filters.door === "All" || filters.door === door;
  const matchesBuilding = (building: string) =>
    filters.building === "All" || filters.building === building;
  const matchesRisk = (risk: RiskRating) =>
    filters.risk === "All" || filters.risk === risk;

  const critical = dashboard.critical.filter(
    (item) =>
      matchesDoor(item.door) &&
      matchesBuilding(item.building) &&
      matchesRisk(item.currentRisk),
  );

  const needsInvestigation = dashboard.needsInvestigation.filter(
    (item) => matchesDoor(item.door) && matchesBuilding(item.building),
  );

  const improvements = dashboard.improvements.filter(
    (item) => matchesDoor(item.door) && matchesBuilding(item.building),
  );

  const recommendations = (
    Object.keys(dashboard.recommendations) as AttentionRecommendationTier[]
  ).reduce<AttentionRecommendationGroups>(
    (accumulator, tier) => {
      accumulator[tier] = dashboard.recommendations[tier].filter((item) => {
        if (item.door && !matchesDoor(item.door)) {
          return false;
        }

        if (!matchesBuilding(item.building)) {
          return false;
        }

        return true;
      });

      return accumulator;
    },
    { critical: [], high: [], medium: [], low: [] },
  );

  const recommendationCount =
    recommendations.critical.length +
    recommendations.high.length +
    recommendations.medium.length +
    recommendations.low.length;

  return {
    ...dashboard,
    filters,
    critical,
    needsInvestigation,
    improvements,
    recommendations,
    summary: {
      criticalCount: critical.length,
      investigationCount: needsInvestigation.length,
      improvementCount: improvements.length,
      recommendationCount,
    },
  };
}

export function buildAttentionCentre(
  input: AttentionCentreBuildInput,
): Omit<AttentionCentreDashboard, "filters"> {
  const critical = buildCriticalItems(input);
  const needsInvestigation = buildInvestigationItems(input);
  const improvements = buildImprovementItems(input);
  const recommendations = buildRecommendationGroups(input);
  const filterOptions = buildFilterOptions(
    input.normalizedIncidents,
    input.report.doors.map((door) => door.door),
  );

  const recommendationCount =
    recommendations.critical.length +
    recommendations.high.length +
    recommendations.medium.length +
    recommendations.low.length;

  return {
    generatedAt: new Date(input.referenceMs ?? Date.now()).toISOString(),
    sourceFileName: input.report.sourceFileName,
    hasProcessedImports: true,
    filterOptions,
    critical,
    needsInvestigation,
    improvements,
    recommendations,
    summary: {
      criticalCount: critical.length,
      investigationCount: needsInvestigation.length,
      improvementCount: improvements.length,
      recommendationCount,
    },
  };
}

export function getDefaultAttentionFilters(
  filterOptions: AttentionCentreFilterOptions,
): AttentionCentreFilters {
  return {
    risk: "All",
    door: "All",
    building: "All",
    dateFrom: filterOptions.dateRange.min,
    dateTo: filterOptions.dateRange.max,
  };
}
