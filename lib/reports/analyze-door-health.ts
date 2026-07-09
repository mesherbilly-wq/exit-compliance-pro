import type { FieldMapping } from "@/lib/imports/types";
import type { FireExitIntelligenceReport } from "@/lib/analytics/types";
import type { DistributionBucket, TrendPoint } from "@/lib/analytics/types";
import { sortDoorProfiles, toDoorHealthAnalysis } from "@/lib/analytics/report-adapters";
import {
  canRunFireExitIntelligence,
  runFireExitIntelligenceEngine,
} from "@/lib/analytics/fire-exit-intelligence-engine";
import type { DoorHealthStatus } from "./held-open-detection";

export type CsvRow = Record<string, string>;

export type DoorHealthRecord = {
  door: string;
  totalEvents: number;
  heldOpenEvents: number;
  averageDurationSeconds: number | null;
  averageDurationLabel: string;
  longestDurationSeconds: number | null;
  longestDurationLabel: string;
  lastEventTime: string;
  complianceScore: number;
  status: DoorHealthStatus;
  totalExposureSeconds: number;
  totalExposureLabel: string;
  repeatOccurrences: number;
  daysAffected: number;
  firstOccurrence: string;
  timeOfDayDistribution: DistributionBucket[];
  dayOfWeekDistribution: DistributionBucket[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
};

export type DoorHealthAnalysis = {
  doors: DoorHealthRecord[];
  totalDoors: number;
  excellentDoors: number;
  doorsNeedingAttention: number;
  criticalDoors: number;
  worstDoor: string;
  sourceFileName: string;
  hasDurationField: boolean;
  intelligence: FireExitIntelligenceReport;
};

export function analyzeDoorHealth(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
  sourceFileName: string,
): DoorHealthAnalysis {
  const report = runFireExitIntelligenceEngine(rows, headers, {
    sourceFileName,
    savedMapping: mapping,
  });

  return toDoorHealthAnalysis(report);
}

export function canRunDoorHealthAnalysis(
  rows: CsvRow[],
  mapping: FieldMapping | null,
): boolean {
  return canRunFireExitIntelligence(rows, mapping);
}

export type DoorSortKey = "score" | "heldOpen" | "longestDuration" | "exposure";

export function sortDoors(
  doors: DoorHealthRecord[],
  sortBy: DoorSortKey,
): DoorHealthRecord[] {
  if (sortBy === "exposure") {
    return [...doors].sort(
      (a, b) => b.totalExposureSeconds - a.totalExposureSeconds,
    );
  }

  return sortDoorProfiles(doors, sortBy);
}
