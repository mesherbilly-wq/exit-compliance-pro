import type { FireExitAnalyticsConfig } from "./types";

export const DEFAULT_IMPORT_DATA_RETENTION_DAYS = 31;
export const MIN_IMPORT_DATA_RETENTION_DAYS = 1;
export const MAX_IMPORT_DATA_RETENTION_DAYS = 3650;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeImportDataRetentionDays(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_IMPORT_DATA_RETENTION_DAYS;
  }

  const rounded = Math.round(parsed);
  return Math.min(
    MAX_IMPORT_DATA_RETENTION_DAYS,
    Math.max(MIN_IMPORT_DATA_RETENTION_DAYS, rounded),
  );
}

export function getRetentionCutoffMs(
  retentionDays: number,
  referenceTimeMs: number = Date.now(),
): number {
  const days = normalizeImportDataRetentionDays(retentionDays);
  return referenceTimeMs - days * MS_PER_DAY;
}

export function isTimestampWithinRetention(
  timestamp: number,
  retentionDays: number,
  referenceTimeMs: number = Date.now(),
): boolean {
  return timestamp >= getRetentionCutoffMs(retentionDays, referenceTimeMs);
}

export function filterEventsByRetention<T extends { timestamp: number }>(
  events: T[],
  config: FireExitAnalyticsConfig,
  referenceTimeMs: number = Date.now(),
): T[] {
  const retentionDays = normalizeImportDataRetentionDays(
    config.importDataRetentionDays,
  );
  const cutoff = getRetentionCutoffMs(retentionDays, referenceTimeMs);
  return events.filter((event) => event.timestamp >= cutoff);
}

export function filterIncidentsByRetention<
  T extends { startTimestamp: number },
>(
  incidents: T[],
  config: FireExitAnalyticsConfig,
  referenceTimeMs: number = Date.now(),
): T[] {
  const retentionDays = normalizeImportDataRetentionDays(
    config.importDataRetentionDays,
  );
  const cutoff = getRetentionCutoffMs(retentionDays, referenceTimeMs);
  return incidents.filter((incident) => incident.startTimestamp >= cutoff);
}

export function importRecordOverlapsRetention(
  record: {
    reporting_period_start: string | null;
    reporting_period_end: string | null;
    created_at: string;
  },
  config: FireExitAnalyticsConfig,
  referenceTimeMs: number = Date.now(),
): boolean {
  const cutoff = getRetentionCutoffMs(
    normalizeImportDataRetentionDays(config.importDataRetentionDays),
    referenceTimeMs,
  );

  const periodEnd = record.reporting_period_end
    ? new Date(record.reporting_period_end).getTime()
    : null;
  const periodStart = record.reporting_period_start
    ? new Date(record.reporting_period_start).getTime()
    : null;
  const createdAt = new Date(record.created_at).getTime();

  if (periodEnd != null && periodEnd >= cutoff) {
    return true;
  }

  if (periodStart != null && periodStart >= cutoff) {
    return true;
  }

  return createdAt >= cutoff;
}

export function filterEventsByImportIdForRetention(
  eventsByImportId: Map<string, { timestamp: number }[]>,
  config: FireExitAnalyticsConfig,
  referenceTimeMs: number = Date.now(),
): Map<string, { timestamp: number }[]> {
  const filtered = new Map<string, { timestamp: number }[]>();

  for (const [importId, events] of eventsByImportId) {
    const kept = filterEventsByRetention(events, config, referenceTimeMs);
    if (kept.length > 0) {
      filtered.set(importId, kept);
    }
  }

  return filtered;
}
