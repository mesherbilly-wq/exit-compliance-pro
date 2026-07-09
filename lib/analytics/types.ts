import type { FieldMapping } from "@/lib/imports/types";
import type { DoorHealthStatus } from "@/lib/reports/held-open-detection";

export type RiskRating = "Low" | "Medium" | "High" | "Critical";

export type FireExitAnalyticsConfig = {
  heldOpenThresholdSeconds: number;
};

export type IncidentDurationBucket =
  | "Brief"
  | "Moderate"
  | "Extended"
  | "Critical";

export type ComplianceIncident = {
  door: string;
  startTimestamp: number;
  endTimestamp: number;
  startTimeLabel: string;
  endTimeLabel: string;
  durationSeconds: number;
  thresholdSeconds: number;
  timeBeyondThresholdSeconds: number;
  riskRating: RiskRating;
  durationBucket: IncidentDurationBucket;
  dayStarted: string;
  hourStarted: number;
  isExplicitAlarm: boolean;
  eventType: string;
};

/** @deprecated Use ComplianceIncident */
export type HeldOpenSession = ComplianceIncident & {
  exposureSeconds: number;
};

export function toHeldOpenSession(incident: ComplianceIncident): HeldOpenSession {
  return {
    ...incident,
    exposureSeconds: incident.timeBeyondThresholdSeconds,
  };
}

export type DistributionBucket = {
  label: string;
  count: number;
  exposureSeconds: number;
};

export type TrendPoint = {
  periodKey: string;
  label: string;
  heldOpenEvents: number;
  exposureSeconds: number;
};

export type DoorIntelligenceProfile = {
  door: string;
  totalFireExitEvents: number;
  totalIncidents: number;
  /** @deprecated Use totalIncidents */
  totalHeldOpenEvents: number;
  totalExposureSeconds: number;
  totalExposureLabel: string;
  averageHeldOpenDurationSeconds: number | null;
  averageHeldOpenDurationLabel: string;
  longestHeldOpenDurationSeconds: number | null;
  longestHeldOpenDurationLabel: string;
  repeatOccurrences: number;
  daysAffected: number;
  firstOccurrence: string;
  lastOccurrence: string;
  timeOfDayDistribution: DistributionBucket[];
  dayOfWeekDistribution: DistributionBucket[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  complianceScore: number;
  status: DoorHealthStatus;
  incidents: ComplianceIncident[];
  /** @deprecated Use incidents */
  sessions: ComplianceIncident[];
};

export type FireExitPortfolioSummary = {
  totalDoors: number;
  doorsWithViolations: number;
  totalFireExitEvents: number;
  totalHeldOpenEvents: number;
  totalExposureSeconds: number;
  totalExposureLabel: string;
  overallComplianceScore: number;
  excellentDoors: number;
  doorsNeedingAttention: number;
  criticalDoors: number;
  worstDoor: string;
  hasDurationField: boolean;
};

export type FireExitIntelligenceReport = {
  config: FireExitAnalyticsConfig;
  mapping: FieldMapping;
  sourceFileName: string;
  analyzedRowCount: number;
  analyzedAt: string;
  doors: DoorIntelligenceProfile[];
  summary: FireExitPortfolioSummary;
};

export type ParsedFireExitEvent = {
  door: string;
  eventType: string;
  eventTime: string;
  timestamp: number;
  csvDurationSeconds: number | null;
};
