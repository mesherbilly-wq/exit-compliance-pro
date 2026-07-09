import type { FieldMapping } from "@/lib/imports/types";
import type { DoorHealthStatus } from "@/lib/reports/held-open-detection";

export type FireExitAnalyticsConfig = {
  heldOpenThresholdSeconds: number;
};

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

export type HeldOpenSession = {
  door: string;
  startTimestamp: number;
  endTimestamp: number;
  startTimeLabel: string;
  endTimeLabel: string;
  durationSeconds: number;
  exposureSeconds: number;
  isExplicitAlarm: boolean;
  eventType: string;
};

export type DoorIntelligenceProfile = {
  door: string;
  totalFireExitEvents: number;
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
  sessions: HeldOpenSession[];
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
