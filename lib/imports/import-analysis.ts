import type { FieldMapping, ImportAnalysisSnapshot } from "./types";
import { resolveFieldMapping } from "./resolve-mapping";
import {
  runFireExitIntelligenceEngine,
} from "@/lib/analytics/fire-exit-intelligence-engine";
import { toDoorHealthAnalysis } from "@/lib/analytics/report-adapters";
import type { DoorHealthAnalysis } from "@/lib/reports/analyze-door-health";
import type { CsvRow } from "./types";
import type { FireExitIntelligenceReport } from "@/lib/analytics/types";

export function buildImportAnalysis(
  headers: string[],
  rows: CsvRow[],
  fileName: string,
  savedMapping?: FieldMapping | null,
): ImportAnalysisSnapshot {
  const report = runFireExitIntelligenceEngine(rows, headers, {
    sourceFileName: fileName,
    savedMapping,
  });

  return toImportAnalysisSnapshot(report, rows.length);
}

export function toImportAnalysisSnapshot(
  report: FireExitIntelligenceReport,
  analyzedRowCount: number,
): ImportAnalysisSnapshot {
  return {
    mapping: report.mapping,
    analyzedRowCount,
    intelligence: report,
  };
}

export function doorHealthFromSnapshot(
  snapshot: ImportAnalysisSnapshot,
): DoorHealthAnalysis {
  if (!snapshot.intelligence) {
    throw new Error("Import snapshot is missing intelligence report.");
  }

  return toDoorHealthAnalysis(snapshot.intelligence);
}

export function intelligenceFromSnapshot(
  snapshot: ImportAnalysisSnapshot,
): FireExitIntelligenceReport | null {
  return snapshot.intelligence ?? null;
}

export function isFullImportAnalysis(
  record: { rowCount: number; analysisSnapshot?: ImportAnalysisSnapshot },
): boolean {
  return (
    !!record.analysisSnapshot &&
    record.analysisSnapshot.analyzedRowCount >= record.rowCount
  );
}
