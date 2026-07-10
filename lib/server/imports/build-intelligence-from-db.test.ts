import { describe, expect, it } from "vitest";
import { buildComplianceIncidents } from "@/lib/analytics/compliance-incidents";
import { groupEventsByDoor } from "@/lib/analytics/parse-events";

describe("buildComplianceIncidents threshold sensitivity", () => {
  const events = [
    {
      door: "Test Door",
      eventType: "Door opened",
      eventTime: "7/10/2026 7:00:00 AM",
      timestamp: 1_000_000,
      csvDurationSeconds: null,
    },
    {
      door: "Test Door",
      eventType: "Door closed",
      eventTime: "7/10/2026 7:00:22 AM",
      timestamp: 1_022_000,
      csvDurationSeconds: null,
    },
  ];

  it("finds no incidents above a 30 second threshold", () => {
    const incidents = buildComplianceIncidents(events, {
      heldOpenThresholdSeconds: 30,
    });

    expect(incidents).toHaveLength(0);
  });

  it("finds incidents when threshold is lower than open duration", () => {
    const incidents = buildComplianceIncidents(events, {
      heldOpenThresholdSeconds: 15,
    });

    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0]?.timeBeyondThresholdSeconds).toBeGreaterThan(0);
  });

  it("groups events by door before incident detection", () => {
    const grouped = groupEventsByDoor(events);
    const incidents = buildComplianceIncidents(grouped.get("Test Door") ?? [], {
      heldOpenThresholdSeconds: 15,
    });

    expect(incidents).toHaveLength(1);
  });
});
