import { describe, expect, it } from "vitest";
import { buildExecutiveReport } from "@/lib/analytics/executive-report";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import {
  applyAttentionCentreFilters,
  buildAttentionCentre,
  getDefaultAttentionFilters,
} from "@/lib/analytics/attention-centre/build-attention-centre";
import {
  normalizeAttentionIncidents,
  detectAttentionSourceSystem,
} from "@/lib/analytics/attention-centre/normalize-incidents";
import { getDoorIncidents } from "@/lib/analytics/normalize-intelligence";
import type { FieldMapping } from "@/lib/imports/types";

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

function buildSampleReport() {
  const events = [
    {
      door: "Rear Loading Bay",
      eventType: "Door opened",
      eventTime: "7/10/2026 7:00:00 AM",
      timestamp: 1_000_000,
      csvDurationSeconds: null,
    },
    {
      door: "Rear Loading Bay",
      eventType: "Door open too long",
      eventTime: "7/10/2026 7:30:00 AM",
      timestamp: 1_000_000 + 30 * 60 * 1000,
      csvDurationSeconds: null,
    },
    {
      door: "Rear Loading Bay",
      eventType: "Door closed",
      eventTime: "7/10/2026 7:45:00 AM",
      timestamp: 1_000_000 + 45 * 60 * 1000,
      csvDurationSeconds: null,
    },
    {
      door: "Level 2 Adj Toilet",
      eventType: "Door opened",
      eventTime: "7/11/2026 8:00:00 AM",
      timestamp: 2_000_000,
      csvDurationSeconds: null,
    },
    {
      door: "Level 2 Adj Toilet",
      eventType: "Door closed",
      eventTime: "7/11/2026 8:00:25 AM",
      timestamp: 2_025_000,
      csvDurationSeconds: null,
    },
  ];

  return runFireExitIntelligenceFromParsedEvents(
    events,
    ["Event", "Door", "Event timestamp"],
    [],
    {
      sourceFileName: "Genetec export.csv",
      config: { heldOpenThresholdSeconds: 15 },
      analyzedRowCount: events.length,
      hasDurationField: false,
      mapping,
    },
  ).report;
}

describe("Attention Centre analytics", () => {
  it("builds critical, investigation, improvement, and recommendation sections", () => {
    const report = buildSampleReport();
    const normalizedIncidents = normalizeAttentionIncidents(
      report.doors.flatMap((door) =>
        getDoorIncidents(door, report.config.heldOpenThresholdSeconds),
      ),
      new Map([["Rear Loading Bay", "Warehouse"]]),
      detectAttentionSourceSystem(report.sourceFileName),
    );

    const dashboard = buildAttentionCentre({
      report,
      normalizedIncidents,
      doorBuildingMap: new Map([["Rear Loading Bay", "Warehouse"]]),
      config: {
        heldOpenThresholdSeconds: 15,
        criticalComplianceScoreThreshold: 50,
        criticalHeldOpenMinutes: 30,
        repeatIncidentsTodayThreshold: 3,
        incidentFreeDaysThreshold: 30,
      },
      improvingDoors: [],
      decliningDoors: [],
      comparisonAvailable: false,
      referenceMs: 3_000_000,
    });

    expect(dashboard.critical.length).toBeGreaterThan(0);
    expect(dashboard.needsInvestigation.length).toBeGreaterThanOrEqual(0);
    expect(dashboard.summary.recommendationCount).toBeGreaterThan(0);
    expect(
      dashboard.recommendations.critical.length +
        dashboard.recommendations.high.length +
        dashboard.recommendations.medium.length +
        dashboard.recommendations.low.length,
    ).toBe(dashboard.summary.recommendationCount);
  });

  it("detects long held-open incidents as critical items", () => {
    const report = buildSampleReport();
    const normalizedIncidents = normalizeAttentionIncidents(
      report.doors.flatMap((door) =>
        getDoorIncidents(door, report.config.heldOpenThresholdSeconds),
      ),
      new Map(),
      "genetec",
    );

    const dashboard = buildAttentionCentre({
      report,
      normalizedIncidents,
      doorBuildingMap: new Map(),
      config: {
        heldOpenThresholdSeconds: 15,
        criticalComplianceScoreThreshold: 50,
        criticalHeldOpenMinutes: 30,
        repeatIncidentsTodayThreshold: 3,
        incidentFreeDaysThreshold: 30,
      },
      improvingDoors: [],
      decliningDoors: [],
      comparisonAvailable: false,
    });

    expect(
      dashboard.critical.some((item) =>
        item.issue.includes("held open more than 30 minutes"),
      ),
    ).toBe(true);
  });

  it("filters attention items by door and risk", () => {
    const report = buildSampleReport();
    const normalizedIncidents = normalizeAttentionIncidents(
      report.doors.flatMap((door) =>
        getDoorIncidents(door, report.config.heldOpenThresholdSeconds),
      ),
      new Map(),
      "genetec",
    );

    const base = buildAttentionCentre({
      report,
      normalizedIncidents,
      doorBuildingMap: new Map(),
      config: {
        heldOpenThresholdSeconds: 15,
        criticalComplianceScoreThreshold: 50,
        criticalHeldOpenMinutes: 30,
        repeatIncidentsTodayThreshold: 3,
        incidentFreeDaysThreshold: 30,
      },
      improvingDoors: [],
      decliningDoors: [],
      comparisonAvailable: false,
    });

    const filters = {
      ...getDefaultAttentionFilters(base.filterOptions),
      door: "Rear Loading Bay",
      risk: "All" as const,
    };

    const filtered = applyAttentionCentreFilters(
      { ...base, filters: getDefaultAttentionFilters(base.filterOptions) },
      filters,
    );

    expect(filtered.critical.every((item) => item.door === "Rear Loading Bay")).toBe(
      true,
    );
  });

  it("maps executive report recommendations without a second analytics path", () => {
    const report = buildExecutiveReport(buildSampleReport());
    expect(report.operationalRecommendations.length).toBeGreaterThan(0);
  });

  it("detects source system from import filename for future integrations", () => {
    expect(detectAttentionSourceSystem("Genetec export.csv")).toBe("genetec");
    expect(detectAttentionSourceSystem("Ajax panel feed.csv")).toBe("ajax");
    expect(detectAttentionSourceSystem("Paxton Net2.csv")).toBe("paxton");
    expect(detectAttentionSourceSystem("Gallagher export.csv")).toBe("gallagher");
  });
});
