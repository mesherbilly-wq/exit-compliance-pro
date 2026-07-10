import type { FieldMapping, ImportRecord } from "./types";
import {
  buildImportAnalysis,
  doorHealthFromSnapshot,
} from "./import-analysis";
import { resolveFieldMapping } from "./resolve-mapping";
import {
  analyzeDoorHealth,
  canRunDoorHealthAnalysis,
  type DoorHealthAnalysis,
} from "@/lib/reports/analyze-door-health";

export function getImportDoorHealthAnalysis(
  importRecord: ImportRecord,
  rows: Record<string, string>[],
): { analysis: DoorHealthAnalysis | null; mapping: FieldMapping | null } {
  const savedMapping = importRecord.analysisSnapshot?.mapping ?? null;

  const mapping = savedMapping
    ? savedMapping
    : resolveFieldMapping(importRecord.headers, rows, null);

  if (importRecord.analysisSnapshot?.intelligence) {
    return {
      analysis: doorHealthFromSnapshot(importRecord.analysisSnapshot),
      mapping: importRecord.analysisSnapshot.mapping,
    };
  }

  if (!canRunDoorHealthAnalysis(rows, mapping)) {
    return { analysis: null, mapping };
  }

  return {
    analysis: analyzeDoorHealth(
      rows,
      mapping,
      importRecord.headers,
      importRecord.fileName,
    ),
    mapping,
  };
}

export function loadLatestDoorHealthData(
  importRecord: ImportRecord | null,
): {
  importRecord: ImportRecord | null;
  mapping: FieldMapping | null;
  rows: Record<string, string>[];
  analysis: DoorHealthAnalysis | null;
} {
  if (!importRecord) {
    return { importRecord: null, mapping: null, rows: [], analysis: null };
  }

  const rows: Record<string, string>[] = [];
  const { analysis, mapping } = getImportDoorHealthAnalysis(importRecord, rows);

  return {
    importRecord,
    mapping,
    rows,
    analysis,
  };
}
