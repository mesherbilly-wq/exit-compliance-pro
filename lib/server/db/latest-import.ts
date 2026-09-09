import { listImportsWithAnalytics } from "@/lib/server/db/inbound-email-repository";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import {
  getRetentionCutoffMs,
  importRecordOverlapsRetention,
  normalizeImportDataRetentionDays,
} from "@/lib/analytics/import-data-retention";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";

export async function listImportsForAnalytics(
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord[]> {
  const records = await listImportsWithAnalytics();
  const ordered = [...records].reverse();

  if (!config) {
    return ordered;
  }

  return ordered.filter((record) =>
    importRecordOverlapsRetention(record, config),
  );
}

export function getEventLoadOptionsForRetention(
  config: FireExitAnalyticsConfig,
): { minTimestamp: number } {
  return {
    minTimestamp: getRetentionCutoffMs(
      normalizeImportDataRetentionDays(config.importDataRetentionDays),
    ),
  };
}

export async function getLatestImportForAnalytics(
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord | null> {
  const imports = await listImportsForAnalytics(config);
  return imports.at(-1) ?? null;
}

export async function getLatestProcessedServerImport(
  config?: FireExitAnalyticsConfig,
): Promise<ServerImportRecord | null> {
  return getLatestImportForAnalytics(config);
}
