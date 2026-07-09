import type { FieldMapping, ImportAnalysisSnapshot } from "./types";
import { resolveFieldMapping } from "./resolve-mapping";
import {
  runFireExitIntelligenceWithArtifacts,
  refreshIntelligenceReportWithConfig,
} from "@/lib/analytics/fire-exit-intelligence-engine";
import { getAnalyticsConfig } from "@/lib/analytics/config";
import { toDoorHealthAnalysis } from "@/lib/analytics/report-adapters";
import type { DoorHealthAnalysis } from "@/lib/reports/analyze-door-health";
import type { CsvRow } from "./types";
import type {
  FireExitIntelligenceReport,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import { normalizeIntelligenceReport } from "@/lib/analytics/normalize-intelligence";

export function buildImportAnalysis(
  headers: string[],
  rows: CsvRow[],
  fileName: string,
  savedMapping?: FieldMapping | null,
): ImportAnalysisSnapshot {
  const artifacts = runFireExitIntelligenceWithArtifacts(rows, headers, {
    sourceFileName: fileName,
    savedMapping,
  });

  return toImportAnalysisSnapshot(
    artifacts.report,
    rows.length,
    artifacts.parsedEvents,
    artifacts.hasDurationField,
  );
}

export function toImportAnalysisSnapshot(
  report: FireExitIntelligenceReport,
  analyzedRowCount: number,
  parsedEvents?: ParsedFireExitEvent[],
  hasDurationField?: boolean,
): ImportAnalysisSnapshot {
  return {
    mapping: report.mapping,
    analyzedRowCount,
    intelligence: report,
    parsedEvents,
    hasDurationField,
  };
}

export function rebuildImportAnalysisWithCurrentConfig(
  snapshot: ImportAnalysisSnapshot,
  headers: string[],
  fileName: string,
): ImportAnalysisSnapshot | null {
  const refreshed = refreshIntelligenceReportWithConfig(
    snapshot,
    headers,
    fileName,
    getAnalyticsConfig(),
  );

  if (!refreshed) {
    return null;
  }

  return {
    mapping: refreshed.report.mapping,
    analyzedRowCount: snapshot.analyzedRowCount,
    intelligence: refreshed.report,
    parsedEvents: refreshed.parsedEvents,
    hasDurationField: refreshed.hasDurationField,
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
  if (!snapshot.intelligence) {
    return null;
  }

  return normalizeIntelligenceReport(snapshot.intelligence);
}

export function isFullImportAnalysis(
  record: { rowCount: number; analysisSnapshot?: ImportAnalysisSnapshot },
): boolean {
  return (
    !!record.analysisSnapshot &&
    record.analysisSnapshot.analyzedRowCount >= record.rowCount
  );
}

export function snapshotHasReplayEvents(snapshot: ImportAnalysisSnapshot): boolean {
  return Array.isArray(snapshot.parsedEvents) && snapshot.parsedEvents.length > 0;
}
