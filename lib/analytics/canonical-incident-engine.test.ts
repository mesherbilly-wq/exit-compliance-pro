import { describe, expect, it } from "vitest";
import {
  buildCanonicalIncidentsByDoor,
  countCanonicalIncidents,
  MAX_CARRY_FORWARD_MS,
} from "./canonical-incident-engine";
import { buildComplianceIncidents } from "./compliance-incidents";
import {
  DERIVED_THRESHOLD_EXCEEDED_LABEL,
} from "./incident-classification";
import { pairDoorOpenCloseSessions } from "./door-open-close-pairing";
import { dedupeParsedEvents } from "./dedupe-parsed-events";
import type { ParsedFireExitEvent } from "./types";

const DOOR = "Door A";
const CLULOW = "Ground - Adj David Clulow";

function event(
  door: string,
  eventType: string,
  timestamp: number,
  eventTime: string,
  extras?: Partial<ParsedFireExitEvent>,
): ParsedFireExitEvent {
  return {
    door,
    eventType,
    eventTime,
    timestamp,
    csvDurationSeconds: null,
    sourceSystem: "genetec",
    ...extras,
  };
}

describe("canonical incident engine", () => {
  it("creates a derived incident for open/close over threshold", () => {
    const incidents = buildComplianceIncidents(
      [
        event(DOOR, "Door opened", 0, "open"),
        event(DOOR, "Door closed", 120_000, "close"),
      ],
      { heldOpenThresholdSeconds: 30 },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.classification).toBe("derived_threshold_exceeded");
    expect(incidents[0]?.eventType).toBe(DERIVED_THRESHOLD_EXCEEDED_LABEL);
  });

  it("does not create incidents below threshold", () => {
    const incidents = buildComplianceIncidents(
      [
        event(DOOR, "Door opened", 0, "open"),
        event(DOOR, "Door closed", 20_000, "close"),
      ],
      { heldOpenThresholdSeconds: 30 },
    );

    expect(incidents).toHaveLength(0);
  });

  it("handles reverse-chronological CSV input via deterministic sort", () => {
    const result = pairDoorOpenCloseSessions([
      event(DOOR, "Door closed", 9000, "close"),
      event(DOOR, "Door opened", 0, "open"),
    ]);

    expect(result.sessions[0]?.durationSeconds).toBe(9);
  });

  it("uses source row order for same-timestamp open and close", () => {
    const ts = 1783584579000;
    const tsOpen1 = 1783584575000;
    const tsClose = 1783585100000;
    const result = pairDoorOpenCloseSessions([
      event(CLULOW, "Door opened", tsOpen1, "7/9/2026 8:09:35 AM", {
        sourceSequence: 0,
      }),
      event(CLULOW, "Door closed", ts, "7/9/2026 8:09:39 AM", {
        sourceSequence: 1,
      }),
      event(CLULOW, "Door opened", ts, "7/9/2026 8:09:39 AM", {
        sourceSequence: 2,
      }),
      event(CLULOW, "Door closed", tsClose, "7/9/2026 8:18:20 AM", {
        sourceSequence: 3,
      }),
    ]);

    expect(result.sessions.some((session) => session.durationSeconds === 521)).toBe(
      true,
    );
  });

  it("deduplicates duplicate events across overlapping imports", () => {
    const sharedOpen = event(CLULOW, "Door opened", 1000, "shared-open", {
      sourceSequence: 0,
    });
    const sharedClose = event(CLULOW, "Door closed", 4000, "shared-close", {
      sourceSequence: 1,
    });
    const eventsByImportId = new Map([
      ["import-a", [sharedOpen, sharedClose]],
      ["import-b", [sharedOpen, sharedClose]],
    ]);

    expect(dedupeParsedEvents([...eventsByImportId.values()].flat())).toHaveLength(
      2,
    );

    const incidents = buildCanonicalIncidentsByDoor({
      eventsByImportId,
      config: { heldOpenThresholdSeconds: 30 },
    }).incidentsByDoor;

    expect(incidents.get(CLULOW) ?? []).toHaveLength(0);
  });

  it("records orphan closes without creating incidents", () => {
    const diagnostics = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([
        [
          "import-a",
          [event(DOOR, "Door closed", 1000, "orphan-close", { sourceSequence: 0 })],
        ],
      ]),
      config: { heldOpenThresholdSeconds: 30 },
    }).diagnostics;

    expect(diagnostics.orphanCloses).toHaveLength(1);
    expect(countCanonicalIncidents(
      buildCanonicalIncidentsByDoor({
        eventsByImportId: new Map([
          ["import-a", [event(DOOR, "Door closed", 1000, "orphan-close")]],
        ]),
        config: { heldOpenThresholdSeconds: 30 },
      }).incidentsByDoor,
    )).toBe(0);
  });

  it("expires unmatched opens instead of inventing duration", () => {
    const diagnostics = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([
        [
          "import-a",
          [event(DOOR, "Door opened", 0, "open", { sourceSequence: 0 })],
        ],
      ]),
      config: { heldOpenThresholdSeconds: 30 },
    }).diagnostics;

    expect(diagnostics.expiredUnmatchedOpens).toHaveLength(1);
  });

  it("allows legitimate cross-import pairing within carry-forward window", () => {
    const importA = "import-a";
    const importB = "import-b";
    const openTs = 1_000_000;
    const closeTs = openTs + 600_000;

    const incidents = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([
        [importA, [event(DOOR, "Door opened", openTs, "open-a", { sourceSequence: 0 })]],
        [
          importB,
          [event(DOOR, "Door closed", closeTs, "close-b", { sourceSequence: 0 })],
        ],
      ]),
      importContexts: new Map([
        [
          importA,
          {
            importId: importA,
            reportingPeriodStart: new Date(openTs - 1000).toISOString(),
            reportingPeriodEnd: new Date(openTs + 1000).toISOString(),
            createdAt: new Date(openTs - 1000).toISOString(),
          },
        ],
        [
          importB,
          {
            importId: importB,
            reportingPeriodStart: new Date(closeTs - 1000).toISOString(),
            reportingPeriodEnd: new Date(closeTs + 1000).toISOString(),
            createdAt: new Date(closeTs - 1000).toISOString(),
          },
        ],
      ]),
      config: { heldOpenThresholdSeconds: 30 },
    }).incidentsByDoor.get(DOOR);

    expect(incidents).toHaveLength(1);
    expect(incidents?.[0]?.durationSeconds).toBe(600);
  });

  it("expires pending open across empty intermediate imports", () => {
    const importA = "import-a";
    const importB = "import-b-empty";
    const importC = "import-c";
    const openTs = 0;
    const closeTs = MAX_CARRY_FORWARD_MS + 60_000;

    const incidents = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([
        [importA, [event(DOOR, "Door opened", openTs, "open-a")]],
        [importB, []],
        [importC, [event(DOOR, "Door closed", closeTs, "close-c")]],
      ]),
      importContexts: new Map([
        [
          importA,
          {
            importId: importA,
            reportingPeriodStart: new Date(openTs).toISOString(),
            reportingPeriodEnd: new Date(openTs + 3_600_000).toISOString(),
            createdAt: new Date(openTs).toISOString(),
          },
        ],
        [
          importB,
          {
            importId: importB,
            reportingPeriodStart: new Date(openTs + 3_600_000).toISOString(),
            reportingPeriodEnd: new Date(openTs + 7_200_000).toISOString(),
            createdAt: new Date(openTs + 3_600_000).toISOString(),
          },
        ],
        [
          importC,
          {
            importId: importC,
            reportingPeriodStart: new Date(closeTs - 1000).toISOString(),
            reportingPeriodEnd: new Date(closeTs + 1000).toISOString(),
            createdAt: new Date(closeTs - 1000).toISOString(),
          },
        ],
      ]),
      config: { heldOpenThresholdSeconds: 30 },
    });

    expect(incidents.incidentsByDoor.get(DOOR) ?? []).toHaveLength(0);
    expect(incidents.diagnostics.expiredUnmatchedOpens.length).toBeGreaterThan(0);
    expect(incidents.diagnostics.orphanCloses).toHaveLength(1);
  });

  it("prevents invalid long cross-import pairing beyond carry-forward", () => {
    const importA = "import-a";
    const importB = "import-b";
    const openTs = 0;
    const closeTs = MAX_CARRY_FORWARD_MS + 60_000;

    const incidents = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([
        [importA, [event(DOOR, "Door opened", openTs, "open-a")]],
        [importB, [event(DOOR, "Door closed", closeTs, "close-b")]],
      ]),
      importContexts: new Map([
        [
          importA,
          {
            importId: importA,
            reportingPeriodStart: null,
            reportingPeriodEnd: null,
            createdAt: new Date(openTs).toISOString(),
          },
        ],
        [
          importB,
          {
            importId: importB,
            reportingPeriodStart: null,
            reportingPeriodEnd: null,
            createdAt: new Date(closeTs).toISOString(),
          },
        ],
      ]),
      config: { heldOpenThresholdSeconds: 30 },
    });

    expect(incidents.incidentsByDoor.get(DOOR) ?? []).toHaveLength(0);
    expect(incidents.diagnostics.expiredUnmatchedOpens).toHaveLength(1);
    expect(incidents.diagnostics.orphanCloses).toHaveLength(1);
  });

  it("classifies native held-open alarms separately from derived incidents", () => {
    const incidents = buildComplianceIncidents(
      [
        event(DOOR, "Door opened", 0, "open"),
        event(DOOR, "Door open too long", 300_000, "held"),
        event(DOOR, "Door closed", 600_000, "close"),
      ],
      { heldOpenThresholdSeconds: 30 },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.classification).toBe("native_held_open_alarm");
    expect(incidents[0]?.isExplicitAlarm).toBe(true);
    expect(incidents[0]?.eventType).toBe("Door open too long");
  });

  it("matches exact Ground - Adj David Clulow Jul 9 morning sequence", () => {
    const tsOpen1 = 1783584575000;
    const tsOpen2 = 1783584579000;
    const tsClose = 1783585100000;

    const incidents = buildComplianceIncidents(
      [
        event(CLULOW, "Door opened", tsOpen1, "7/9/2026 8:09:35 AM", {
          sourceSequence: 0,
        }),
        event(CLULOW, "Door closed", tsOpen2, "7/9/2026 8:09:39 AM", {
          sourceSequence: 1,
        }),
        event(CLULOW, "Door opened", tsOpen2, "7/9/2026 8:09:39 AM", {
          sourceSequence: 2,
        }),
        event(CLULOW, "Door closed", tsClose, "7/9/2026 8:18:20 AM", {
          sourceSequence: 3,
        }),
      ],
      { heldOpenThresholdSeconds: 300 },
      { includeTrace: true },
    );

    const match = incidents.find(
      (incident) => incident.endTimeLabel === "7/9/2026 8:18:20 AM",
    );

    expect(match?.durationSeconds).toBe(521);
    expect(match?.classification).toBe("derived_threshold_exceeded");
    expect(match?.trace?.qualificationReason).toContain("threshold");
  });

  it("keeps stored and live incident counts consistent for a single import", () => {
    const importId = "import-single";
    const events = [
      event(DOOR, "Door opened", 0, "open"),
      event(DOOR, "Door closed", 120_000, "close"),
    ];

    const live = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([[importId, events]]),
      config: { heldOpenThresholdSeconds: 30 },
    });

    const storedStyle = buildComplianceIncidents(events, {
      heldOpenThresholdSeconds: 30,
    });

    expect(countCanonicalIncidents(live.incidentsByDoor)).toBe(storedStyle.length);
  });
});
