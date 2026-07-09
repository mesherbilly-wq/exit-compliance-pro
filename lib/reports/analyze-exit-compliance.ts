import type { FieldMapping } from "@/lib/imports/types";
import type { ComplianceIntelligenceDashboard } from "@/lib/analytics/compliance-intelligence";
import type { FireExitIntelligenceReport } from "@/lib/analytics/types";
import { toExitComplianceAnalysis } from "@/lib/analytics/report-adapters";
import {
  canRunFireExitIntelligence,
  runFireExitIntelligenceEngine,
} from "@/lib/analytics/fire-exit-intelligence-engine";

export type CsvRow = Record<string, string>;

export type ExitComplianceAnalysis = {
  totalEvents: number;
  uniqueDoors: number;
  forcedOpenEvents: number;
  heldOpenEvents: number;
  lifeSafetyExceptions: number;
  otherEvents: number;
  totalExposureLabel?: string;
  doorBreakdown: {
    door: string;
    count: number;
    exposureLabel?: string;
  }[];
  recentExceptions: {
    time: string;
    type: string;
    door: string;
    result: string;
  }[];
  intelligence: FireExitIntelligenceReport;
  complianceDashboard?: ComplianceIntelligenceDashboard;
};

export function analyzeExitCompliance(
  rows: CsvRow[],
  mapping: FieldMapping,
  headers: string[],
  sourceFileName: string,
): ExitComplianceAnalysis {
  const report = runFireExitIntelligenceEngine(rows, headers, {
    sourceFileName: sourceFileName || "Import",
    savedMapping: mapping,
  });

  return toExitComplianceAnalysis(report);
}

export function canRunExitComplianceAnalysis(
  rows: CsvRow[],
  mapping: FieldMapping | null,
): boolean {
  return canRunFireExitIntelligence(rows, mapping);
}
