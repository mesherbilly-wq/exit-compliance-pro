import { describe, expect, it } from "vitest";
import { buildComplianceIncidents } from "@/lib/analytics/compliance-incidents";
import { groupEventsByDoor } from "@/lib/analytics/parse-events";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import type { FieldMapping } from "@/lib/imports/types";

describe("accumulated analytics", () => {
  const mapping: FieldMapping = {
    eventTime: "Event timestamp",
    eventType: "Event",
    doorName: "Door",
    cardholderName: "",
    cardholderEmail: "",
    credentialNumber: "",
    accessResult: "",
    siteBuilding: "",
  };

  it("combines parsed events from multiple imports into one report", () => {
    const importOneEvents = [
      {
        door: "Door A",
        eventType: "Door opened",
        eventTime: "7/10/2026 7:00:00 AM",
        timestamp: 1_000_000,
        csvDurationSeconds: null,
      },
      {
        door: "Door A",
        eventType: "Door closed",
        eventTime: "7/10/2026 7:00:25 AM",
        timestamp: 1_025_000,
        csvDurationSeconds: null,
      },
    ];

    const importTwoEvents = [
      {
        door: "Door B",
        eventType: "Door opened",
        eventTime: "7/11/2026 8:00:00 AM",
        timestamp: 2_000_000,
        csvDurationSeconds: null,
      },
      {
        door: "Door B",
        eventType: "Door open too long",
        eventTime: "7/11/2026 8:00:20 AM",
        timestamp: 2_020_000,
        csvDurationSeconds: null,
      },
      {
        door: "Door B",
        eventType: "Door closed",
        eventTime: "7/11/2026 8:00:40 AM",
        timestamp: 2_040_000,
        csvDurationSeconds: null,
      },
    ];

    const combined = [...importOneEvents, ...importTwoEvents];
    const report = runFireExitIntelligenceFromParsedEvents(
      combined,
      ["Event", "Door", "Event timestamp"],
      [],
      {
        sourceFileName: "Accumulated (2 imports)",
        config: { heldOpenThresholdSeconds: 15 },
        analyzedRowCount: combined.length,
        hasDurationField: false,
        mapping,
      },
    ).report;

    expect(report.summary.totalDoors).toBe(2);
    expect(report.summary.totalFireExitEvents).toBe(5);
    expect(report.summary.totalHeldOpenEvents).toBeGreaterThan(0);
  });
});

describe("buildComplianceIncidents threshold sensitivity", () => {
  const events = [
    {
      door: "Test Door",
      eventType: "Door opened",
      eventTime: "7/10/2026 7:00:00 AM",
      timestamp: 1_000_000,
      csvDurationSeconds: null,
      sourceSystem: "manual",
    },
    {
      door: "Test Door",
      eventType: "Door closed",
      eventTime: "7/10/2026 7:00:22 AM",
      timestamp: 1_022_000,
      csvDurationSeconds: null,
      sourceSystem: "manual",
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
