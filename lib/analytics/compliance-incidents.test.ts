import { describe, expect, it } from "vitest";
import { buildComplianceIncidents } from "./compliance-incidents";
import type { ParsedFireExitEvent } from "./types";

const THRESHOLD = 30;

function openCloseOnly(
  openMs: number,
  closeMs: number,
): ParsedFireExitEvent[] {
  return [
    {
      door: "Ground - Adj David Clulow",
      eventType: "Door opened",
      eventTime: "15/07/2026, 08:23:01",
      timestamp: openMs,
      csvDurationSeconds: null,
    },
    {
      door: "Ground - Adj David Clulow",
      eventType: "Door closed",
      eventTime: "15/07/2026, 08:41:12",
      timestamp: closeMs,
      csvDurationSeconds: null,
    },
  ];
}

describe("buildComplianceIncidents", () => {
  it("creates incidents from open-close duration when it exceeds the threshold", () => {
    const incidents = buildComplianceIncidents(
      openCloseOnly(0, 1091_000),
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.durationSeconds).toBe(1091);
    expect(incidents[0]?.isExplicitAlarm).toBe(false);
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
        },
        {
          door: "Fire Exit A",
          eventType: "Door open too long",
          eventTime: "1/15/2025 8:05 AM",
          timestamp: 300_000,
          csvDurationSeconds: null,
        },
        {
          door: "Fire Exit A",
          eventType: "Door closed",
          eventTime: "1/15/2025 8:10 AM",
          timestamp: 600_000,
          csvDurationSeconds: null,
        },
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.durationSeconds).toBe(600);
    expect(incidents[0]?.isExplicitAlarm).toBe(true);
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
        },
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.durationSeconds).toBe(120);
  });
});
