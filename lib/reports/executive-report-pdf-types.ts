import type { ExecutiveReport } from "@/lib/analytics/executive-report";
import { getDoorIncidents } from "@/lib/analytics/normalize-intelligence";
import { TIME_BEYOND_THRESHOLD_LABEL } from "@/lib/analytics/labels";
import { formatDurationLabel } from "@/lib/reports/held-open-detection";

export type ExecutiveReportPdfRiskRow = {
  rank: number;
  door: string;
  riskRating: string;
  complianceScore: number;
  trend: string;
  summary: string;
};

export type ExecutiveReportPdfImprovementRow = {
  rank: number;
  door: string;
  complianceScore: number;
  trend: string;
  summary: string;
};

export type ExecutiveReportPdfTrendRow = {
  label: string;
  incidents: number;
  timeBeyondThresholdLabel: string;
};

export type ExecutiveReportPdfRecommendation = {
  priority: string;
  title: string;
  summary: string;
  action: string;
};

export type ExecutiveReportPdfData = {
  productName: string;
  reportTitle: string;
  reportDateLabel: string;
  generatedAtLabel: string;
  reportingPeriodLabel: string;
  sourceFileName: string;
  overallComplianceScore: number;
  siteHealthRating: string;
  siteHealthSummary: string;
  complianceTrendDirection: string;
  complianceTrendLabel: string;
  doorsMonitored: number;
  complianceIncidents: number;
  timeBeyondThresholdLabel: string;
  longestIncidentLabel: string;
  longestIncidentDoor: string;
  highestRiskDoor: string;
  highestRiskDoorDetail: string;
  topComplianceRisks: ExecutiveReportPdfRiskRow[];
  topImprovements: ExecutiveReportPdfImprovementRow[];
  weeklyTrend: ExecutiveReportPdfTrendRow[];
  recommendations: ExecutiveReportPdfRecommendation[];
};

const MAX_TEXT_LENGTH = 500;

export function sanitizePdfText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function findLongestIncident(report: ExecutiveReport): {
  door: string;
  label: string;
} {
  let longestSeconds = -1;
  let door = "N/A";
  let label = "N/A";

  for (const doorProfile of report.intelligence.doors) {
    for (const incident of getDoorIncidents(
      doorProfile,
      report.intelligence.config.heldOpenThresholdSeconds,
    )) {
      if (incident.timeBeyondThresholdSeconds > longestSeconds) {
        longestSeconds = incident.timeBeyondThresholdSeconds;
        door = sanitizePdfText(incident.door, 120);
        label = formatDurationLabel(incident.timeBeyondThresholdSeconds);
      }
    }
  }

  return { door, label };
}

export function mapExecutiveReportToPdfData(
  report: ExecutiveReport,
  reportingPeriodLabel?: string,
  generatedAt = new Date(),
): ExecutiveReportPdfData {
  const longestIncident = findLongestIncident(report);

  return {
    productName: "Exit Compliance Pro",
    reportTitle: "Management Review",
    reportDateLabel: sanitizePdfText(report.reportDateLabel),
    generatedAtLabel: generatedAt.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    reportingPeriodLabel: sanitizePdfText(
      reportingPeriodLabel ?? report.dataPeriodLabel,
    ),
    sourceFileName: sanitizePdfText(report.sourceFileName, 180),
    overallComplianceScore: report.overallComplianceScore,
    siteHealthRating: sanitizePdfText(report.siteHealthRating),
    siteHealthSummary: sanitizePdfText(report.siteHealthSummary),
    complianceTrendDirection: sanitizePdfText(report.complianceTrend.direction),
    complianceTrendLabel: sanitizePdfText(report.complianceTrend.label),
    doorsMonitored: report.totalDoors,
    complianceIncidents: report.intelligence.summary.totalHeldOpenEvents,
    timeBeyondThresholdLabel: sanitizePdfText(report.totalExposureLabel),
    longestIncidentLabel: sanitizePdfText(longestIncident.label),
    longestIncidentDoor: longestIncident.door,
    highestRiskDoor: sanitizePdfText(report.highestRiskDoor, 120),
    highestRiskDoorDetail: sanitizePdfText(report.highestRiskDoorDetail),
    topComplianceRisks: report.topComplianceRisks.map((item) => ({
      rank: item.rank,
      door: sanitizePdfText(item.door, 120),
      riskRating: sanitizePdfText(item.riskRating),
      complianceScore: item.complianceScore,
      trend: sanitizePdfText(item.trend),
      summary: sanitizePdfText(item.summary),
    })),
    topImprovements: report.topImprovements.map((item) => ({
      rank: item.rank,
      door: sanitizePdfText(item.door, 120),
      complianceScore: item.complianceScore,
      trend: sanitizePdfText(item.trend),
      summary: sanitizePdfText(item.summary),
    })),
    weeklyTrend: report.complianceTrend.recentPeriods.map((point) => ({
      label: sanitizePdfText(point.label, 40),
      incidents: point.heldOpenEvents,
      timeBeyondThresholdLabel: formatDurationLabel(point.exposureSeconds),
    })),
    recommendations: report.operationalRecommendations.slice(0, 12).map((item) => ({
      priority: sanitizePdfText(item.priority),
      title: sanitizePdfText(item.title, 160),
      summary: sanitizePdfText(item.summary, 240),
      action: sanitizePdfText(item.action, 240),
    })),
  };
}

export function formatExecutiveReportPdfFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `Exit-Compliance-Pro-Management-Review-${year}-${month}-${day}.pdf`;
}

export function getTimeBeyondThresholdHeading(): string {
  return TIME_BEYOND_THRESHOLD_LABEL;
}
