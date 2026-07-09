import type {
  FireExitIntelligenceReport,
  TrendPoint,
} from "./types";
import {
  buildDoorIntelligenceRows,
  getTopHighestRiskDoors,
  getTopImprovingDoors,
  type DoorIntelligenceRow,
  type RiskRating,
  type TrendDirection,
} from "./door-intelligence-view";
import {
  buildComplianceIntelligenceDashboard,
  type ComplianceRecommendation,
} from "./compliance-intelligence";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";

export type SiteHealthRating =
  | "Excellent"
  | "Good"
  | "Fair"
  | "Poor"
  | "Critical";

export type ComplianceTrendSummary = {
  direction: TrendDirection;
  label: string;
  changePercent: number | null;
  recentPeriods: TrendPoint[];
};

export type ExecutiveRiskItem = {
  rank: number;
  door: string;
  riskRating: RiskRating;
  complianceScore: number;
  exposureLabel: string;
  occurrences: number;
  trend: TrendDirection;
  summary: string;
};

export type ExecutiveImprovementItem = {
  rank: number;
  door: string;
  complianceScore: number;
  trend: TrendDirection;
  exposureLabel: string;
  summary: string;
};

export type ExecutiveReport = {
  reportDate: string;
  reportDateLabel: string;
  sourceFileName: string;
  analyzedAt: string;
  dataPeriodLabel: string;
  overallComplianceScore: number;
  complianceTrend: ComplianceTrendSummary;
  highestRiskDoor: string;
  highestRiskDoorDetail: string;
  totalExposureLabel: string;
  totalExposureSeconds: number;
  criticalIncidents: number;
  criticalIncidentsLabel: string;
  siteHealthRating: SiteHealthRating;
  siteHealthSummary: string;
  totalDoors: number;
  healthyDoors: number;
  doorsRequiringAttention: number;
  criticalDoors: number;
  topComplianceRisks: ExecutiveRiskItem[];
  topImprovements: ExecutiveImprovementItem[];
  operationalRecommendations: ComplianceRecommendation[];
  intelligence: FireExitIntelligenceReport;
};

function formatReportDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function aggregatePortfolioWeeklyTrend(
  report: FireExitIntelligenceReport,
): TrendPoint[] {
  const grouped = new Map<string, TrendPoint>();

  for (const door of report.doors) {
    for (const point of door.weeklyTrend) {
      const existing = grouped.get(point.periodKey) ?? {
        periodKey: point.periodKey,
        label: point.label,
        heldOpenEvents: 0,
        exposureSeconds: 0,
      };

      existing.heldOpenEvents += point.heldOpenEvents;
      existing.exposureSeconds += point.exposureSeconds;
      grouped.set(point.periodKey, existing);
    }
  }

  return [...grouped.values()].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey),
  );
}

function trendMetric(points: TrendPoint[]): number {
  if (points.length === 0) {
    return 0;
  }

  return (
    points.reduce(
      (sum, point) => sum + point.exposureSeconds + point.heldOpenEvents * 10,
      0,
    ) / points.length
  );
}

function buildComplianceTrend(
  report: FireExitIntelligenceReport,
): ComplianceTrendSummary {
  const recentPeriods = aggregatePortfolioWeeklyTrend(report);

  if (recentPeriods.length < 2) {
    return {
      direction: "N/A",
      label: "Insufficient trend data",
      changePercent: null,
      recentPeriods,
    };
  }

  const midpoint = Math.floor(recentPeriods.length / 2);
  const earlier = recentPeriods.slice(0, midpoint);
  const recent = recentPeriods.slice(midpoint);
  const earlierAverage = trendMetric(earlier);
  const recentAverage = trendMetric(recent);

  if (earlierAverage === 0 && recentAverage === 0) {
    return {
      direction: "Stable",
      label: "Stable — no held-open exposure recorded",
      changePercent: 0,
      recentPeriods,
    };
  }

  if (earlierAverage === 0 && recentAverage > 0) {
    return {
      direction: "Deteriorating",
      label: "Deteriorating — new held-open exposure in recent weeks",
      changePercent: null,
      recentPeriods,
    };
  }

  const changeRatio = (recentAverage - earlierAverage) / Math.max(earlierAverage, 1);
  const changePercent = Math.round(changeRatio * 100);

  if (changeRatio <= -0.2) {
    return {
      direction: "Improving",
      label: `Improving — exposure down ${Math.abs(changePercent)}% vs earlier period`,
      changePercent,
      recentPeriods,
    };
  }

  if (changeRatio >= 0.2) {
    return {
      direction: "Deteriorating",
      label: `Deteriorating — exposure up ${changePercent}% vs earlier period`,
      changePercent,
      recentPeriods,
    };
  }

  return {
    direction: "Stable",
    label: "Stable — exposure within normal variance",
    changePercent,
    recentPeriods,
  };
}

function getSiteHealthRating(report: FireExitIntelligenceReport): {
  rating: SiteHealthRating;
  summary: string;
} {
  const { summary } = report;
  const criticalShare =
    summary.totalDoors > 0 ? summary.criticalDoors / summary.totalDoors : 0;

  if (summary.overallComplianceScore >= 90 && summary.criticalDoors === 0) {
    return {
      rating: "Excellent",
      summary: "Fire exit compliance is strong with minimal life safety exposure.",
    };
  }

  if (summary.overallComplianceScore >= 80 && criticalShare <= 0.1) {
    return {
      rating: "Good",
      summary: "Site fire exit performance is acceptable with limited remediation required.",
    };
  }

  if (summary.overallComplianceScore >= 70) {
    return {
      rating: "Fair",
      summary: "Compliance is moderate — targeted operational review is recommended.",
    };
  }

  if (summary.overallComplianceScore >= 50 && criticalShare <= 0.25) {
    return {
      rating: "Poor",
      summary: "Elevated fire exit risk requires management attention and corrective action.",
    };
  }

  return {
    rating: "Critical",
    summary: "Significant life safety exposure — immediate executive intervention required.",
  };
}

function countCriticalIncidents(report: FireExitIntelligenceReport): number {
  let count = 0;

  for (const door of report.doors) {
    for (const session of door.sessions) {
      const isCriticalDoor = door.status === "Critical";
      const isHighExposure = session.exposureSeconds >= 180;

      if (isCriticalDoor || isHighExposure) {
        count += 1;
      }
    }
  }

  return count;
}

function buildDataPeriodLabel(report: FireExitIntelligenceReport): string {
  const timestamps = report.doors.flatMap((door) =>
    door.sessions.map((session) => session.startTimestamp),
  );

  if (timestamps.length === 0) {
    return "No held-open incidents in analysed period";
  }

  timestamps.sort((a, b) => a - b);
  const start = new Date(timestamps[0]).toLocaleDateString("en-GB");
  const end = new Date(timestamps[timestamps.length - 1]).toLocaleDateString(
    "en-GB",
  );

  return `${start} – ${end}`;
}

function toExecutiveRiskItem(
  row: DoorIntelligenceRow,
  rank: number,
): ExecutiveRiskItem {
  return {
    rank,
    door: row.door,
    riskRating: row.riskRating,
    complianceScore: row.complianceScore,
    exposureLabel: row.totalExposureLabel,
    occurrences: row.occurrences,
    trend: row.trend,
    summary: `${row.riskRating} risk · ${row.totalExposureLabel} exposure · ${row.occurrences} held-open session${row.occurrences === 1 ? "" : "s"}`,
  };
}

function toExecutiveImprovementItem(
  row: DoorIntelligenceRow,
  rank: number,
): ExecutiveImprovementItem {
  return {
    rank,
    door: row.door,
    complianceScore: row.complianceScore,
    trend: row.trend,
    exposureLabel: row.totalExposureLabel,
    summary: `Improving trend · ${row.complianceScore}% compliance · ${row.totalExposureLabel} remaining exposure`,
  };
}

function buildTopComplianceRisks(
  rows: DoorIntelligenceRow[],
): ExecutiveRiskItem[] {
  const ranked = getTopHighestRiskDoors(rows, 5);

  if (ranked.length >= 5) {
    return ranked.map((row, index) => toExecutiveRiskItem(row, index + 1));
  }

  const seen = new Set(ranked.map((row) => row.door));
  const additional = [...rows]
    .filter((row) => !seen.has(row.door) && row.occurrences > 0)
    .sort((a, b) => a.complianceScore - b.complianceScore);

  const combined = [...ranked, ...additional].slice(0, 5);

  return combined.map((row, index) => toExecutiveRiskItem(row, index + 1));
}

function buildTopImprovements(
  rows: DoorIntelligenceRow[],
): ExecutiveImprovementItem[] {
  const improving = getTopImprovingDoors(rows, 5);

  if (improving.length >= 5) {
    return improving.map((row, index) => toExecutiveImprovementItem(row, index + 1));
  }

  const seen = new Set(improving.map((row) => row.door));
  const stableHighPerformers = [...rows]
    .filter(
      (row) =>
        !seen.has(row.door) &&
        row.complianceScore >= 85 &&
        row.trend !== "Deteriorating",
    )
    .sort((a, b) => b.complianceScore - a.complianceScore);

  const combined = [...improving, ...stableHighPerformers].slice(0, 5);

  return combined.map((row, index) => toExecutiveImprovementItem(row, index + 1));
}

export function buildExecutiveReport(
  report: FireExitIntelligenceReport,
  reportDate = new Date().toISOString(),
): ExecutiveReport {
  const rows = buildDoorIntelligenceRows(report.doors);
  const compliance = buildComplianceIntelligenceDashboard(report);
  const highestRisk = getTopHighestRiskDoors(rows, 1)[0];
  const { rating, summary: siteHealthSummary } = getSiteHealthRating(report);
  const criticalIncidents = countCriticalIncidents(report);

  const healthyDoors = report.doors.filter(
    (door) => door.status === "Excellent" || door.status === "Good",
  ).length;

  const topComplianceRisks = buildTopComplianceRisks(rows);
  const topImprovements = buildTopImprovements(rows);

  return {
    reportDate,
    reportDateLabel: formatReportDate(reportDate),
    sourceFileName: report.sourceFileName,
    analyzedAt: report.analyzedAt,
    dataPeriodLabel: buildDataPeriodLabel(report),
    overallComplianceScore: report.summary.overallComplianceScore,
    complianceTrend: buildComplianceTrend(report),
    highestRiskDoor: highestRisk?.door ?? report.summary.worstDoor,
    highestRiskDoorDetail: highestRisk
      ? `${highestRisk.riskRating} risk · ${highestRisk.totalExposureLabel} exposure`
      : "No held-open violations recorded",
    totalExposureLabel: report.summary.totalExposureLabel,
    totalExposureSeconds: report.summary.totalExposureSeconds,
    criticalIncidents,
    criticalIncidentsLabel:
      criticalIncidents === 0
        ? "No critical incidents"
        : `${criticalIncidents} session${criticalIncidents === 1 ? "" : "s"} requiring executive attention`,
    siteHealthRating: rating,
    siteHealthSummary,
    totalDoors: report.summary.totalDoors,
    healthyDoors,
    doorsRequiringAttention: report.summary.doorsNeedingAttention,
    criticalDoors: report.summary.criticalDoors,
    topComplianceRisks,
    topImprovements,
    operationalRecommendations: compliance.recommendations,
    intelligence: report,
  };
}

export function formatExposureForExecutive(seconds: number): string {
  return formatDurationLabel(seconds);
}
