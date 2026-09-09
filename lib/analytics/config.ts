import type { FireExitAnalyticsConfig } from "./types";
import {
  DEFAULT_IMPORT_DATA_RETENTION_DAYS,
  normalizeImportDataRetentionDays,
} from "./import-data-retention";

const CONFIG_STORAGE_KEY = "exit-compliance-pro:analytics-config";

export const DEFAULT_HELD_OPEN_THRESHOLD_SECONDS = 30;
export { DEFAULT_IMPORT_DATA_RETENTION_DAYS };

export const DEFAULT_ANALYTICS_CONFIG: FireExitAnalyticsConfig = {
  heldOpenThresholdSeconds: DEFAULT_HELD_OPEN_THRESHOLD_SECONDS,
  importDataRetentionDays: DEFAULT_IMPORT_DATA_RETENTION_DAYS,
};

export function getAnalyticsConfig(): FireExitAnalyticsConfig {
  if (typeof window === "undefined") {
    return DEFAULT_ANALYTICS_CONFIG;
  }

  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ANALYTICS_CONFIG;
    }

    const parsed = JSON.parse(raw) as Partial<FireExitAnalyticsConfig>;
    const threshold = Number(parsed.heldOpenThresholdSeconds);

    return {
      heldOpenThresholdSeconds:
        Number.isFinite(threshold) && threshold > 0
          ? threshold
          : DEFAULT_HELD_OPEN_THRESHOLD_SECONDS,
      importDataRetentionDays: normalizeImportDataRetentionDays(
        parsed.importDataRetentionDays,
      ),
    };
  } catch {
    return DEFAULT_ANALYTICS_CONFIG;
  }
}

export function saveAnalyticsConfig(config: FireExitAnalyticsConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}
