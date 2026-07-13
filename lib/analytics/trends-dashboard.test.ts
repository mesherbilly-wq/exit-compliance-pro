import { describe, expect, it } from "vitest";
import type { FieldMapping } from "@/lib/imports/types";
import {
  buildTrendsDashboard,
  type BuildTrendsDashboardInput,
} from "@/lib/analytics/trends-dashboard";
import {
  chooseGroupingForRange,
  getDefaultTrendsPreset,
  refineLastImportBounds,
  resolveTrendsPeriodBounds,
  validateCustomTrendsRange,
} from "@/lib/analytics/trends-period";

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

const MS_DAY = 24 * 60 * 60 * 1000;
const BASE_TIME = Date.parse("2026-07-01T08:00:00");

function createOpenCloseEvents(input: {
  door: string;
  startMs: number;
  openSeconds: number;
}) {
  return [
    {
      door: input.door,
      eventType: "Door opened",
      eventTime: new Date(input.startMs).toISOString(),
      timestamp: input.startMs,
      csvDurationSeconds: null,
    },
    {
      door: input.door,
      eventType: "Door closed",
      eventTime: new Date(input.startMs + input.openSeconds * 1000).toISOString(),
      timestamp: input.startMs + input.openSeconds * 1000,
      csvDurationSeconds: null,
    },
  ];
}

function buildInput(
  overrides: Partial<BuildTrendsDashboardInput> & {
    bounds: BuildTrendsDashboardInput["bounds"];
  },
): BuildTrendsDashboardInput {
  const allEvents = overrides.allEvents ?? [];
  const eventsByImportId =
    overrides.eventsByImportId ??
    new Map([
      ["import-a", allEvents],
    ]);

  return {
    allEvents,
    eventsByImportId,
    metadata: {
      headers: ["Event", "Door", "Event timestamp"],
      mapping,
      hasDurationField: false,
      analyzedRowCount: allEvents.length,
      sourceFileName: "Test import",
    },
    config: { heldOpenThresholdSeconds: 15 },
    ...overrides,
  };
}

describe("trends period validation", () => {
  it("rejects empty custom ranges", () => {
    expect(validateCustomTrendsRange("", "").valid).toBe(false);
  });

  it("rejects end dates before start dates", () => {
    expect(
      validateCustomTrendsRange("2026-07-10", "2026-07-01").valid,
    ).toBe(false);
  });

  it("accepts valid custom ranges", () => {
    expect(
      validateCustomTrendsRange("2026-07-01", "2026-07-10").valid,
    ).toBe(true);
  });
});

describe("trends period defaults and grouping", () => {
  it("defaults to last 7 days when enough data exists", () => {
    expect(getDefaultTrendsPreset(8 * MS_DAY)).toBe("last-7-days");
  });

  it("defaults to all time when data span is short", () => {
    expect(getDefaultTrendsPreset(2 * MS_DAY)).toBe("all-time");
  });

  it("groups last 24 hours by hour", () => {
    expect(chooseGroupingForRange("last-24-hours", MS_DAY)).toBe("hour");
  });

  it("groups last 7 days by day", () => {
    expect(chooseGroupingForRange("last-7-days", 7 * MS_DAY)).toBe("day");
  });

  it("groups long custom ranges by month", () => {
    expect(chooseGroupingForRange("custom", 200 * MS_DAY)).toBe("month");
  });
});

describe("previous period comparison", () => {
  it("compares last 7 days against the previous 7 days", () => {
    const dataStartMs = BASE_TIME;
    const dataEndMs = BASE_TIME + 20 * MS_DAY;
    const { bounds } = resolveTrendsPeriodBounds({
      preset: "last-7-days",
      dataStartMs,
      dataEndMs,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
      nowMs: dataEndMs,
    });

    expect(bounds?.comparisonAvailable).toBe(true);
    expect(bounds?.comparisonStartMs).toBeLessThan(bounds?.startMs ?? 0);
  });

  it("does not compare all time unless a split exists", () => {
    const { bounds } = resolveTrendsPeriodBounds({
      preset: "all-time",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + 30 * MS_DAY,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
    });

    expect(bounds?.comparisonAvailable).toBe(false);
  });

  it("compares custom ranges with the immediately preceding equal duration", () => {
    const { bounds } = resolveTrendsPeriodBounds({
      preset: "custom",
      customStart: "2026-07-10",
      customEnd: "2026-07-16",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + 30 * MS_DAY,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
    });

    expect(bounds?.comparisonAvailable).toBe(true);
    expect(bounds?.comparisonEndMs).toBe(bounds!.startMs - 1);
  });
});

describe("last import comparison", () => {
  it("uses previous import for comparison when available", () => {
    const { bounds } = resolveTrendsPeriodBounds({
      preset: "last-import",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + MS_DAY,
      imports: [
        { id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" },
        { id: "import-b", createdAt: "2026-07-02", fileName: "B.csv" },
      ],
    });

    expect(bounds?.importId).toBe("import-b");
    expect(bounds?.previousImportId).toBe("import-a");
    expect(bounds?.comparisonAvailable).toBe(true);
  });

  it("refines last import bounds to import event timestamps", () => {
    const events = createOpenCloseEvents({
      door: "Door A",
      startMs: BASE_TIME + 3 * MS_DAY,
      openSeconds: 40,
    });

    const { bounds } = resolveTrendsPeriodBounds({
      preset: "last-import",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + 10 * MS_DAY,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
    });

    const refined = refineLastImportBounds(bounds!, events);
    expect(refined.startMs).toBe(events[0]!.timestamp);
    expect(refined.endMs).toBe(events[1]!.timestamp);
  });
});

describe("trends dashboard rankings and empty states", () => {
  it("ranks improving and declining doors by compliance score change", () => {
    const importAEvents = [
      ...createOpenCloseEvents({
        door: "Improving Door",
        startMs: BASE_TIME,
        openSeconds: 60,
      }),
      ...createOpenCloseEvents({
        door: "Declining Door",
        startMs: BASE_TIME + MS_DAY,
        openSeconds: 20,
      }),
    ];

    const importBEvents = [
      ...createOpenCloseEvents({
        door: "Improving Door",
        startMs: BASE_TIME + 10 * MS_DAY,
        openSeconds: 20,
      }),
      ...createOpenCloseEvents({
        door: "Declining Door",
        startMs: BASE_TIME + 11 * MS_DAY,
        openSeconds: 80,
      }),
    ];

    const { bounds } = resolveTrendsPeriodBounds({
      preset: "last-import",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + 12 * MS_DAY,
      imports: [
        { id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" },
        { id: "import-b", createdAt: "2026-07-12", fileName: "B.csv" },
      ],
    });

    const dashboard = buildTrendsDashboard(
      buildInput({
        allEvents: [...importAEvents, ...importBEvents],
        eventsByImportId: new Map([
          ["import-a", importAEvents],
          ["import-b", importBEvents],
        ]),
        bounds: bounds!,
      }),
    );

    expect(dashboard.improvingComparisonAvailable).toBe(true);
    expect(dashboard.topImprovingDoors[0]?.door).toBe("Improving Door");
    expect(dashboard.topDecliningDoors[0]?.door).toBe("Declining Door");
  });

  it("reports when no incidents exist in the selected period", () => {
    const quietEvents = createOpenCloseEvents({
      door: "Quiet Door",
      startMs: BASE_TIME,
      openSeconds: 5,
    });

    const { bounds } = resolveTrendsPeriodBounds({
      preset: "last-7-days",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + 2 * MS_DAY,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
      nowMs: BASE_TIME + 2 * MS_DAY,
    });

    const dashboard = buildTrendsDashboard(
      buildInput({
        allEvents: quietEvents,
        bounds: bounds!,
      }),
    );

    expect(dashboard.hasIncidentsInPeriod).toBe(false);
    expect(dashboard.incidentTrend.totalIncidents).toBe(0);
  });

  it("marks comparison unavailable when no historical data exists", () => {
    const events = createOpenCloseEvents({
      door: "Door A",
      startMs: BASE_TIME,
      openSeconds: 40,
    });

    const { bounds } = resolveTrendsPeriodBounds({
      preset: "last-import",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + MS_DAY,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
    });

    const dashboard = buildTrendsDashboard(
      buildInput({
        allEvents: events,
        eventsByImportId: new Map([["import-a", events]]),
        bounds: bounds!,
      }),
    );

    expect(dashboard.improvingComparisonAvailable).toBe(false);
    expect(dashboard.topImprovingDoors).toHaveLength(0);
  });
});

describe("date-range filtering", () => {
  it("filters dashboard metrics to the selected period", () => {
    const earlyEvents = createOpenCloseEvents({
      door: "Door A",
      startMs: BASE_TIME,
      openSeconds: 40,
    });
    const lateEvents = createOpenCloseEvents({
      door: "Door B",
      startMs: BASE_TIME + 10 * MS_DAY,
      openSeconds: 40,
    });
    const allEvents = [...earlyEvents, ...lateEvents];

    const { bounds } = resolveTrendsPeriodBounds({
      preset: "custom",
      customStart: "2026-07-11",
      customEnd: "2026-07-12",
      dataStartMs: BASE_TIME,
      dataEndMs: BASE_TIME + 12 * MS_DAY,
      imports: [{ id: "import-a", createdAt: "2026-07-01", fileName: "A.csv" }],
    });

    const dashboard = buildTrendsDashboard(
      buildInput({
        allEvents,
        bounds: bounds!,
      }),
    );

    expect(dashboard.incidentTrend.totalIncidents).toBe(1);
    expect(dashboard.recurringProblemDoors[0]?.door).toBe("Door B");
  });
});
