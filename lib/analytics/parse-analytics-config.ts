import {
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_HELD_OPEN_THRESHOLD_SECONDS,
  DEFAULT_IMPORT_DATA_RETENTION_DAYS,
} from "@/lib/analytics/config";
import { normalizeImportDataRetentionDays } from "@/lib/analytics/import-data-retention";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";

export function parseAnalyticsConfigFromSearchParams(
  params: URLSearchParams,
): FireExitAnalyticsConfig {
  const thresholdRaw = params.get("heldOpenThresholdSeconds");
  const threshold = Number(thresholdRaw);
  const retentionRaw = params.get("importDataRetentionDays");

  return {
    heldOpenThresholdSeconds:
      Number.isFinite(threshold) && threshold > 0
        ? threshold
        : DEFAULT_HELD_OPEN_THRESHOLD_SECONDS,
    importDataRetentionDays: normalizeImportDataRetentionDays(
      retentionRaw ?? DEFAULT_IMPORT_DATA_RETENTION_DAYS,
    ),
  };
}

export function parseAnalyticsConfigFromRequest(
  request: Request,
): FireExitAnalyticsConfig {
  return parseAnalyticsConfigFromSearchParams(new URL(request.url).searchParams);
}

export function parseAnalyticsConfigFromBody(
  body: Partial<FireExitAnalyticsConfig> | null | undefined,
): FireExitAnalyticsConfig {
  const threshold = Number(body?.heldOpenThresholdSeconds);

  return {
    heldOpenThresholdSeconds:
      Number.isFinite(threshold) && threshold > 0
        ? threshold
        : DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds,
    importDataRetentionDays: normalizeImportDataRetentionDays(
      body?.importDataRetentionDays,
    ),
  };
}

export function buildAnalyticsConfigQueryString(
  config: FireExitAnalyticsConfig,
): string {
  return new URLSearchParams({
    heldOpenThresholdSeconds: String(config.heldOpenThresholdSeconds),
    importDataRetentionDays: String(config.importDataRetentionDays),
  }).toString();
}
