import type { FieldMapping } from "@/lib/imports/types";
import type { DoorHealthStatus } from "@/lib/reports/held-open-detection";
import type { IncidentClassification } from "./incident-classification";
import type { IncidentTrace } from "./incident-trace";

export type RiskRating = "Low" | "Medium" | "High" | "Critical";

export type ComplianceRating = DoorHealthStatus;

export type RiskTrend = "Improving" | "Stable" | "Worsening" | "N/A";

export type IncidentFrequency = "Daily" | "Weekly" | "Monthly" | "Rare";

export type OperationalPattern =
  | "Morning Deliveries"
  | "Lunch Time"
  | "Evenings"
  | "Weekends"
  | "Random"
  | "Recurring";

export type FireExitAnalyticsConfig = {
  heldOpenThresholdSeconds: number;
  importDataRetentionDays: number;
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
  /** Display label — native alarm text or derived threshold label */
  eventType: string;
  classification: IncidentClassification;
  trace?: IncidentTrace;
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

export type DoorComplianceProfile = {
  door: string;
  complianceScore: number;
  complianceRating: ComplianceRating;
  incidents: ComplianceIncident[];
  incidentCount: number;
  timeBeyondThresholdSeconds: number;
  timeBeyondThresholdLabel: string;
  longestIncidentSeconds: number | null;
  longestIncidentLabel: string;
  averageIncidentDurationSeconds: number | null;
  averageIncidentDurationLabel: string;
  averageTimeBeyondThresholdSeconds: number | null;
  averageTimeBeyondThresholdLabel: string;
  lastIncidentLabel: string;
  lastIncidentTimestamp: number | null;
  daysAffected: number;
  mostCommonDay: string;
  mostCommonTime: string;
  peakRiskWindow: string;
  riskTrend: RiskTrend;
  riskTrendScore: number;
  incidentFrequency: IncidentFrequency;
  operationalPattern: OperationalPattern;
  totalFireExitEvents: number;
  repeatOccurrences: number;
  timeOfDayDistribution: DistributionBucket[];
  dayOfWeekDistribution: DistributionBucket[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
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
  /** Canonical rich compliance intelligence for this fire exit */
  complianceProfile?: DoorComplianceProfile;
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
  /** Rich per-door compliance profiles derived from the same analysis pass */
  doorComplianceProfiles?: DoorComplianceProfile[];
  summary: FireExitPortfolioSummary;
};

export type ParsedFireExitEvent = {
  door: string;
  eventType: string;
  eventTime: string;
  timestamp: number;
  csvDurationSeconds: number | null;
  /** Import that stored/parsed this event */
  sourceImportId?: string;
  /** 1-based CSV line number (header = row 1, first data row = 2) */
  sourceRowNumber?: number;
  /** Monotonic parse order within an import (0-based) */
  sourceSequence?: number;
  /** Vendor event identifier when present in source export */
  sourceEventId?: string;
  sourceSystem?: string;
  site?: string;
};
