import type { AccumulatedImportAnalytics } from "@/lib/server/imports/import-analysis-snapshot";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";
import { ANALYTICS_ENGINE_VERSION } from "@/lib/analytics/analytics-engine-version";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  value: AccumulatedImportAnalytics;
};

const accumulatedCache = new Map<string, CacheEntry>();

export function buildAccumulatedAnalyticsCacheKey(
  imports: ServerImportRecord[],
  config: FireExitAnalyticsConfig,
): string {
  const importIds = imports.map((record) => record.id).sort().join(",");
  return `${importIds}|${config.heldOpenThresholdSeconds}|${config.importDataRetentionDays}|${ANALYTICS_ENGINE_VERSION}`;
}

export function getCachedAccumulatedAnalytics(
  cacheKey: string,
): AccumulatedImportAnalytics | null {
  const entry = accumulatedCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    accumulatedCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

export function setCachedAccumulatedAnalytics(
  cacheKey: string,
  value: AccumulatedImportAnalytics,
): void {
  accumulatedCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateAccumulatedAnalyticsCache(): void {
  accumulatedCache.clear();
}
