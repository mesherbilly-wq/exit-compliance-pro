import { describe, expect, it } from "vitest";
import {
  filterEventsByRetention,
  filterIncidentsByRetention,
  getRetentionCutoffMs,
  importRecordOverlapsRetention,
  normalizeImportDataRetentionDays,
} from "@/lib/analytics/import-data-retention";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";

describe("import data retention", () => {
  const referenceTime = Date.UTC(2026, 6, 1, 12, 0, 0);

  it("defaults invalid retention values to 31 days", () => {
    expect(normalizeImportDataRetentionDays(undefined)).toBe(31);
    expect(normalizeImportDataRetentionDays("bad")).toBe(31);
  });

  it("filters events and incidents outside the retention window", () => {
    const config = { ...DEFAULT_ANALYTICS_CONFIG, importDataRetentionDays: 31 };
    const cutoff = getRetentionCutoffMs(31, referenceTime);

    const events = [
      { timestamp: cutoff - 1 },
      { timestamp: cutoff },
      { timestamp: cutoff + 1 },
    ];

    expect(filterEventsByRetention(events, config, referenceTime)).toEqual([
      { timestamp: cutoff },
      { timestamp: cutoff + 1 },
    ]);

    const incidents = [
      { startTimestamp: cutoff - 1 },
      { startTimestamp: cutoff },
    ];

    expect(filterIncidentsByRetention(incidents, config, referenceTime)).toEqual([
      { startTimestamp: cutoff },
    ]);
  });

  it("excludes imports that ended before the retention window", () => {
    const config = { ...DEFAULT_ANALYTICS_CONFIG, importDataRetentionDays: 31 };
    const cutoff = getRetentionCutoffMs(31, referenceTime);

    expect(
      importRecordOverlapsRetention(
        {
          reporting_period_start: new Date(cutoff - 86_400_000).toISOString(),
          reporting_period_end: new Date(cutoff - 1).toISOString(),
          created_at: new Date(cutoff - 86_400_000).toISOString(),
        },
        config,
        referenceTime,
      ),
    ).toBe(false);

    expect(
      importRecordOverlapsRetention(
        {
          reporting_period_start: new Date(cutoff - 86_400_000).toISOString(),
          reporting_period_end: new Date(cutoff + 86_400_000).toISOString(),
          created_at: new Date(cutoff - 86_400_000).toISOString(),
        },
        config,
        referenceTime,
      ),
    ).toBe(true);
  });
});
