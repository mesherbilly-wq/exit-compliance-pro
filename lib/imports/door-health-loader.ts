import type { FieldMapping, ImportRecord } from "@/lib/imports/types";
import {
  buildImportAnalysis,
  doorHealthFromSnapshot,
} from "@/lib/imports/import-analysis";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import {
  getFieldMapping,
  getLatestImport,
  getLatestImportData,
  saveFieldMapping,
} from "@/lib/imports/storage";
import {
  analyzeDoorHealth,
  canRunDoorHealthAnalysis,
  type DoorHealthAnalysis,
} from "@/lib/reports/analyze-door-health";

export function getImportDoorHealthAnalysis(
  importRecord: ImportRecord,
  rows: Record<string, string>[],
): { analysis: DoorHealthAnalysis | null; mapping: FieldMapping | null } {
  const savedMapping =
    importRecord.analysisSnapshot?.mapping ??
    getFieldMapping(importRecord.id);

  const mapping = resolveFieldMapping(
    importRecord.headers,
    rows,
    savedMapping,
  );

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

export function refreshImportDoorHealthAnalysis(
  importRecord: ImportRecord,
  rows: Record<string, string>[],
  mapping: FieldMapping,
): ImportRecord["analysisSnapshot"] {
  const snapshot = buildImportAnalysis(
    importRecord.headers,
    rows,
    importRecord.fileName,
    mapping,
  );

  saveFieldMapping(importRecord.id, snapshot.mapping);
  return snapshot;
}

export function loadLatestDoorHealthData(): {
  importRecord: ImportRecord | null;
  mapping: FieldMapping | null;
  rows: Record<string, string>[];
  analysis: DoorHealthAnalysis | null;
} {
  const latest = getLatestImport();
  if (!latest) {
    return { importRecord: null, mapping: null, rows: [], analysis: null };
  }

  const rows = getLatestImportData();
  const { analysis, mapping } = getImportDoorHealthAnalysis(latest, rows);

  return {
    importRecord: latest,
    mapping,
    rows,
    analysis,
  };
}
