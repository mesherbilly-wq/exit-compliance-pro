import type { DoorIntelligenceProfile, TrendPoint } from "./types";

export type RiskRating = "Low" | "Medium" | "High" | "Critical";

export type TrendDirection = "Improving" | "Deteriorating" | "Stable" | "N/A";

export type DoorIntelligenceRow = {
  door: string;
  complianceScore: number;
  riskRating: RiskRating;
  totalExposureSeconds: number;
  totalExposureLabel: string;
  averageHeldOpenDurationSeconds: number | null;
  averageHeldOpenDurationLabel: string;
  longestHeldOpenDurationSeconds: number | null;
  longestHeldOpenDurationLabel: string;
  occurrences: number;
  daysAffected: number;
  lastIncident: string;
  lastIncidentTimestamp: number | null;
  trend: TrendDirection;
  trendScore: number;
  status: DoorIntelligenceProfile["status"];
};

export type DoorIntelligenceSortKey = keyof Pick<
  DoorIntelligenceRow,
  | "door"
  | "complianceScore"
  | "riskRating"
  | "totalExposureSeconds"
  | "averageHeldOpenDurationSeconds"
  | "longestHeldOpenDurationSeconds"
  | "occurrences"
  | "daysAffected"
  | "lastIncidentTimestamp"
  | "trend"
  | "status"
>;

const RISK_ORDER: Record<RiskRating, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const TREND_ORDER: Record<TrendDirection, number> = {
  Improving: 1,
  Stable: 2,
  Deteriorating: 3,
  "N/A": 4,
};

export function getRiskRating(profile: DoorIntelligenceProfile): RiskRating {
  if (profile.totalHeldOpenEvents === 0) {
    return "Low";
  }

  if (profile.complianceScore >= 85 && profile.totalExposureSeconds < 120) {
    return "Low";
  }

  if (profile.complianceScore >= 70) {
    return "Medium";
  }

  if (profile.complianceScore >= 50) {
    return "High";
  }

  return "Critical";
}

function averageTrendMetric(points: TrendPoint[]): number {
  if (points.length === 0) {
    return 0;
  }

  return (
    points.reduce((sum, point) => sum + point.exposureSeconds + point.heldOpenEvents * 10, 0) /
    points.length
  );
}

export function getTrendDirection(weeklyTrend: TrendPoint[]): {
  trend: TrendDirection;
  trendScore: number;
} {
  if (weeklyTrend.length < 2) {
    return { trend: "N/A", trendScore: 0 };
  }

  const midpoint = Math.floor(weeklyTrend.length / 2);
  const earlier = weeklyTrend.slice(0, midpoint);
  const recent = weeklyTrend.slice(midpoint);
  const earlierAverage = averageTrendMetric(earlier);
  const recentAverage = averageTrendMetric(recent);

  if (earlierAverage === 0 && recentAverage === 0) {
    return { trend: "Stable", trendScore: 0 };
  }

  if (earlierAverage === 0 && recentAverage > 0) {
    return { trend: "Deteriorating", trendScore: recentAverage };
  }

  const changeRatio = (recentAverage - earlierAverage) / Math.max(earlierAverage, 1);
  const trendScore = recentAverage - earlierAverage;

  if (changeRatio <= -0.2) {
    return { trend: "Improving", trendScore };
  }

  if (changeRatio >= 0.2) {
    return { trend: "Deteriorating", trendScore };
  }

  return { trend: "Stable", trendScore };
}

export function toDoorIntelligenceRow(
  profile: DoorIntelligenceProfile,
): DoorIntelligenceRow {
  const { trend, trendScore } = getTrendDirection(profile.weeklyTrend);
  const lastSession = profile.sessions[profile.sessions.length - 1];

  return {
    door: profile.door,
    complianceScore: profile.complianceScore,
    riskRating: getRiskRating(profile),
    totalExposureSeconds: profile.totalExposureSeconds,
    totalExposureLabel: profile.totalExposureLabel,
    averageHeldOpenDurationSeconds: profile.averageHeldOpenDurationSeconds,
    averageHeldOpenDurationLabel: profile.averageHeldOpenDurationLabel,
    longestHeldOpenDurationSeconds: profile.longestHeldOpenDurationSeconds,
    longestHeldOpenDurationLabel: profile.longestHeldOpenDurationLabel,
    occurrences: profile.totalHeldOpenEvents,
    daysAffected: profile.daysAffected,
    lastIncident: profile.lastOccurrence,
    lastIncidentTimestamp: lastSession?.startTimestamp ?? null,
    trend,
    trendScore,
    status: profile.status,
  };
}

export function buildDoorIntelligenceRows(
  profiles: DoorIntelligenceProfile[],
): DoorIntelligenceRow[] {
  return profiles.map(toDoorIntelligenceRow).sort((a, b) => a.door.localeCompare(b.door));
}

export function sortDoorIntelligenceRows(
  rows: DoorIntelligenceRow[],
  sortKey: DoorIntelligenceSortKey,
  direction: "asc" | "desc",
): DoorIntelligenceRow[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortKey === "door" || sortKey === "status") {
      return multiplier * a[sortKey].localeCompare(b[sortKey]);
    }

    if (sortKey === "riskRating") {
      return multiplier * (RISK_ORDER[a.riskRating] - RISK_ORDER[b.riskRating]);
    }

    if (sortKey === "trend") {
      return multiplier * (TREND_ORDER[a.trend] - TREND_ORDER[b.trend]);
    }

    const aValue = a[sortKey] ?? Number.NEGATIVE_INFINITY;
    const bValue = b[sortKey] ?? Number.NEGATIVE_INFINITY;

    if (aValue === bValue) {
      return a.door.localeCompare(b.door);
    }

    return multiplier * (Number(aValue) - Number(bValue));
  });
}

export function getTopHighestRiskDoors(rows: DoorIntelligenceRow[], limit = 10): DoorIntelligenceRow[] {
  return [...rows]
    .filter((row) => row.occurrences > 0)
    .sort((a, b) => {
      if (RISK_ORDER[b.riskRating] !== RISK_ORDER[a.riskRating]) {
        return RISK_ORDER[b.riskRating] - RISK_ORDER[a.riskRating];
      }

      if (b.totalExposureSeconds !== a.totalExposureSeconds) {
        return b.totalExposureSeconds - a.totalExposureSeconds;
      }

      return a.complianceScore - b.complianceScore;
    })
    .slice(0, limit);
}

export function getTopImprovingDoors(rows: DoorIntelligenceRow[], limit = 10): DoorIntelligenceRow[] {
  return [...rows]
    .filter((row) => row.trend === "Improving")
    .sort((a, b) => a.trendScore - b.trendScore)
    .slice(0, limit);
}

export function getTopDeterioratingDoors(
  rows: DoorIntelligenceRow[],
  limit = 10,
): DoorIntelligenceRow[] {
  return [...rows]
    .filter((row) => row.trend === "Deteriorating")
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit);
}

export function getDoorHighlightType(
  door: string,
  highestRisk: DoorIntelligenceRow[],
  improving: DoorIntelligenceRow[],
  deteriorating: DoorIntelligenceRow[],
): "highest-risk" | "improving" | "deteriorating" | null {
  if (highestRisk.some((row) => row.door === door)) {
    return "highest-risk";
  }

  if (improving.some((row) => row.door === door)) {
    return "improving";
  }

  if (deteriorating.some((row) => row.door === door)) {
    return "deteriorating";
  }

  return null;
}
