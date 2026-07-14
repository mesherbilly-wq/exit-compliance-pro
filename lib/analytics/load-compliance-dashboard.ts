import type { ImportRecord } from "@/lib/imports/types";
import {
  buildComplianceIntelligenceDashboard,
  type ComplianceIntelligenceDashboard,
} from "@/lib/analytics/compliance-intelligence";
import { runFireExitIntelligenceEngine } from "@/lib/analytics/fire-exit-intelligence-engine";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";

export function buildComplianceDashboardFromImport(
  latest: ImportRecord | null,
  rows: Record<string, string>[],
): {
  importRecord: ImportRecord | null;
  dashboard: ComplianceIntelligenceDashboard | null;
} {
  if (!latest) {
    return { importRecord: null, dashboard: null };
  }

  const savedMapping = latest.analysisSnapshot?.mapping ?? null;

  if (latest.analysisSnapshot?.intelligence) {
    return {
      importRecord: latest,
      dashboard: buildComplianceIntelligenceDashboard(
        latest.analysisSnapshot.intelligence,
      ),
    };
  }

  const mapping = resolveFieldMapping(latest.headers, rows, savedMapping);
  if (
    !mapping.eventTime.trim() ||
    !mapping.eventType.trim() ||
    !mapping.doorName.trim()
  ) {
    return { importRecord: latest, dashboard: null };
  }

  const report = runFireExitIntelligenceEngine(rows, latest.headers, {
    sourceFileName: latest.fileName,
    savedMapping: mapping,
  });

  return {
    importRecord: latest,
    dashboard: buildComplianceIntelligenceDashboard(report),
  };
}
