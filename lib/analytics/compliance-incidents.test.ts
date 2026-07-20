import { describe, expect, it } from "vitest";
import { buildComplianceIncidents } from "./compliance-incidents";
import type { ParsedFireExitEvent } from "./types";

const THRESHOLD = 30;

function openCloseOnly(
  openMs: number,
  closeMs: number,
  sourceSystem = "manual",
): ParsedFireExitEvent[] {
  return [
    {
      door: "Ground - Adj David Clulow",
      eventType: "Door opened",
      eventTime: "15/07/2026, 08:23:01",
      timestamp: openMs,
      csvDurationSeconds: null,
      sourceSystem,
    },
    {
      door: "Ground - Adj David Clulow",
      eventType: "Door closed",
      eventTime: "15/07/2026, 08:41:12",
      timestamp: closeMs,
      csvDurationSeconds: null,
      sourceSystem,
    },
  ];
}

describe("buildComplianceIncidents", () => {
  it("creates incidents from open-close duration when it exceeds the threshold for non-Genetec sources", () => {
    const incidents = buildComplianceIncidents(
      openCloseOnly(0, 1091_000),
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.durationSeconds).toBe(1091);
    expect(incidents[0]?.isExplicitAlarm).toBe(false);
    expect(incidents[0]?.classification).toBe("derived_open_duration");
  });

  it("does not create Genetec incidents from open-close duration alone", () => {
    const incidents = buildComplianceIncidents(
      openCloseOnly(0, 1091_000, "genetec"),
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(0);
  });

  it("does not create incidents at or below the threshold", () => {
    const incidents = buildComplianceIncidents(
      openCloseOnly(0, 25_000),
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(0);
  });

  it("creates incidents when an explicit held-open alarm follows the open", () => {
    const incidents = buildComplianceIncidents(
      [
        {
          door: "Fire Exit A",
          eventType: "Door opened",
          eventTime: "1/15/2025 8:00 AM",
          timestamp: 0,
          csvDurationSeconds: null,
          sourceSystem: "genetec",
        },
        {
          door: "Fire Exit A",
          eventType: "Door open too long",
          eventTime: "1/15/2025 8:05 AM",
          timestamp: 300_000,
          csvDurationSeconds: null,
          sourceSystem: "genetec",
        },
        {
          door: "Fire Exit A",
          eventType: "Door closed",
          eventTime: "1/15/2025 8:10 AM",
          timestamp: 600_000,
          csvDurationSeconds: null,
          sourceSystem: "genetec",
        },
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.durationSeconds).toBe(600);
    expect(incidents[0]?.isExplicitAlarm).toBe(true);
    expect(incidents[0]?.classification).toBe("native_held_open_alarm");
  });

  it("creates incidents from orphan held-open alarms with csv duration", () => {
    const incidents = buildComplianceIncidents(
      [
        {
          door: "Fire Exit B",
          eventType: "Door open too long",
          eventTime: "1/15/2025 8:10 AM",
          timestamp: 600_000,
          csvDurationSeconds: 120,
          sourceSystem: "genetec",
        },
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.durationSeconds).toBe(120);
  });
});
