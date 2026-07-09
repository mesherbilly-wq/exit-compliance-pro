import type { FieldMapping } from "@/lib/imports/types";
import type { FireExitIntelligenceReport } from "@/lib/analytics/types";
import { toFireExitDashboardAnalysis } from "@/lib/analytics/report-adapters";
import {
  canRunFireExitIntelligence,
  runFireExitIntelligenceEngine,
} from "@/lib/analytics/fire-exit-intelligence-engine";
import type { DoorComplianceStatus } from "./held-open-detection";

export type CsvRow = Record<string, string>;

export type HeldOpenEvent = {
  time: string;
  door: string;
  eventType: string;
  durationSeconds: number | null;
  durationLabel: string;
  exposureLabel?: string;
};

export type ProblemDoor = {
  door: string;
  heldOpenEvents: number;
  averageDurationSeconds: number | null;
  averageDurationLabel: string;
  longestDurationSeconds: number | null;
  longestDurationLabel: string;
  complianceScore: number;
  status: DoorComplianceStatus;
  totalExposureLabel?: string;
};

export type FireExitDashboardAnalysis = {
  overallComplianceScore: number;
  doorsMonitored: number;
  eventsAnalysed: number;
  heldOpenEvents: number;
  averageOpenDurationSeconds: number | null;
  averageOpenDurationLabel: string;
  totalExposureLabel?: string;
  worstPerformingDoor: string;
  problemDoors: ProblemDoor[];
  recentExceptions: HeldOpenEvent[];
  sourceFileName: string;
  intelligence: FireExitIntelligenceReport;
};

export function analyzeFireExitDashboard(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
  sourceFileName: string,
): FireExitDashboardAnalysis {
  const report = runFireExitIntelligenceEngine(rows, headers, {
    sourceFileName,
    savedMapping: mapping,
  });

  return toFireExitDashboardAnalysis(report);
}

export function canRunFireExitDashboard(
  rows: CsvRow[],
  mapping: FieldMapping | null,
): boolean {
  return canRunFireExitIntelligence(rows, mapping);
}
