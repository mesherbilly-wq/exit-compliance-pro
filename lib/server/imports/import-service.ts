import {
  getServerImportById,
  updateServerImport,
} from "@/lib/server/db/inbound-email-repository";
import {
  persistImportAnalytics,
} from "@/lib/server/db/import-analytics-repository";
import { createManualImportFromCsv, reprocessImport } from "@/lib/server/imports/import-processor";
import { rebuildImportsWithCanonicalEngine } from "@/lib/server/imports/rebuild-canonical-analytics";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import type { FieldMapping, ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";

export async function createManualCsvImport(input: {
  fileName: string;
  csvText: string;
  config?: FireExitAnalyticsConfig;
}): Promise<ServerImportRecord> {
  return createManualImportFromCsv(input);
}

export async function updateImportMapping(
  importId: string,
  mapping: FieldMapping,
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord> {
  const existing = await getServerImportById(importId);

  if (!existing) {
    throw new Error("Import not found.");
  }

  await updateServerImport(importId, {
    fieldMapping: mapping,
  });

  await rebuildImportsWithCanonicalEngine(
    config ?? { heldOpenThresholdSeconds: 30 },
  );

  const updated = await getServerImportById(importId);

  if (!updated) {
    throw new Error("Import not found after mapping update.");
  }

  return updated;
}

export async function saveImportAnalysisSnapshot(
  importId: string,
  snapshot: ImportAnalysisSnapshot,
  status?: ServerImportRecord["status"],
): Promise<ServerImportRecord> {
  const analytics = await persistImportAnalytics({
    importId,
    intelligence: snapshot.intelligence,
    parsedEvents: snapshot.parsedEvents ?? [],
    analyticsThresholdSeconds: snapshot.intelligence.config.heldOpenThresholdSeconds,
  });

  return updateServerImport(importId, {
    fieldMapping: snapshot.mapping,
    analysisSnapshot: null,
    status,
    doorCount: analytics.doorCount,
    incidentCount: analytics.incidentCount,
    complianceScoreSnapshot: analytics.complianceScoreSnapshot,
    reportingPeriodStart: analytics.reportingPeriodStart,
    reportingPeriodEnd: analytics.reportingPeriodEnd,
    hasAnalytics: true,
    hasDurationField: snapshot.hasDurationField ?? false,
    analyticsEngineVersion: analytics.analyticsEngineVersion,
    analyticsThresholdSeconds: analytics.analyticsThresholdSeconds,
  });
}

export type RefreshImportAnalysisResult = {
  refreshed: number;
  skipped: number;
};

export async function refreshAllImportAnalysisSnapshots(
  config: FireExitAnalyticsConfig,
): Promise<RefreshImportAnalysisResult> {
  return rebuildImportsWithCanonicalEngine(config);
}

export { reprocessImport };
