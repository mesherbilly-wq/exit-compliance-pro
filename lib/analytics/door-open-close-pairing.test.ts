import { describe, expect, it } from "vitest";
import { buildIncidentsByDoorFromImportGroups } from "./build-incidents-from-imports";
import { buildComplianceIncidents } from "./compliance-incidents";
import { dedupeParsedEvents } from "./dedupe-parsed-events";
import {
  pairDoorOpenCloseSessions,
  type DoorOpenClosePairingLogEntry,
} from "./door-open-close-pairing";
import { groupEventsByDoor } from "./parse-events";
import type { ParsedFireExitEvent } from "./types";

const DOOR_A = "Door A";
const DOOR_B = "Door B";
const CLULOW = "Ground - Adj David Clulow";

function event(
  door: string,
  eventType: string,
  timestamp: number,
  eventTime: string,
): ParsedFireExitEvent {
  return {
    door,
    eventType,
    eventTime,
    timestamp,
    csvDurationSeconds: null,
  };
}

describe("pairDoorOpenCloseSessions", () => {
  it("pairs a normal open then close", () => {
    const sessions = pairDoorOpenCloseSessions([
      event(DOOR_A, "Door opened", 0, "t0"),
      event(DOOR_A, "Door closed", 9000, "t9"),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSeconds).toBe(9);
  });

  it("requires per-door event lists for accurate pairing", () => {
    const grouped = groupEventsByDoor([
      event(DOOR_A, "Door opened", 0, "a-open"),
      event(DOOR_B, "Door opened", 1000, "b-open"),
      event(DOOR_A, "Door closed", 6000, "a-close"),
      event(DOOR_B, "Door closed", 9000, "b-close"),
    ]);

    expect(pairDoorOpenCloseSessions(grouped.get(DOOR_A) ?? [])[0]?.durationSeconds).toBe(6);
    expect(pairDoorOpenCloseSessions(grouped.get(DOOR_B) ?? [])[0]?.durationSeconds).toBe(8);
  });

  it("replaces duplicate opens instead of pairing the first open to a later close", () => {
    const logs: DoorOpenClosePairingLogEntry[] = [];
    const sessions = pairDoorOpenCloseSessions(
      [
        event(DOOR_A, "Door opened", 0, "first-open"),
        event(DOOR_A, "Door opened", 5000, "second-open"),
        event(DOOR_A, "Door closed", 9000, "close"),
      ],
      { debugLogs: logs },
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSeconds).toBe(4);
    expect(logs.some((entry) => entry.action === "duplicate-open-replaced")).toBe(
      true,
    );
  });

  it("ignores orphan closes", () => {
    const logs: DoorOpenClosePairingLogEntry[] = [];
    const sessions = pairDoorOpenCloseSessions(
      [event(DOOR_A, "Door closed", 1000, "orphan-close")],
      { debugLogs: logs },
    );

    expect(sessions).toHaveLength(0);
    expect(logs[0]?.action).toBe("orphan-close");
  });

  it("records unclosed opens without pairing to a later close", () => {
    const logs: DoorOpenClosePairingLogEntry[] = [];
    const sessions = pairDoorOpenCloseSessions(
      [event(DOOR_A, "Door opened", 0, "open")],
      { debugLogs: logs },
    );

    expect(sessions).toHaveLength(0);
    expect(logs[0]?.action).toBe("unclosed-open");
  });

  it("sorts out-of-order events before pairing", () => {
    const sessions = pairDoorOpenCloseSessions([
      event(DOOR_A, "Door closed", 9000, "close"),
      event(DOOR_A, "Door opened", 0, "open"),
    ]);

    expect(sessions[0]?.durationSeconds).toBe(9);
  });
});

describe("Ground - Adj David Clulow latest import events", () => {
  const clulowEvents = [
    event(CLULOW, "Door opened", 1_784_166_738_000, "7/16/2026 1:52:18 AM"),
    event(CLULOW, "Door closed", 1_784_166_744_000, "7/16/2026 1:52:24 AM"),
    event(CLULOW, "Door opened", 1_784_167_218_000, "7/16/2026 2:00:18 AM"),
    event(CLULOW, "Door closed", 1_784_167_227_000, "7/16/2026 2:00:27 AM"),
    event(CLULOW, "Door opened", 1_784_167_240_000, "7/16/2026 2:00:40 AM"),
    event(CLULOW, "Door closed", 1_784_167_247_000, "7/16/2026 2:00:47 AM"),
    event(CLULOW, "Door opened", 1_784_167_382_000, "7/16/2026 2:03:02 AM"),
    event(CLULOW, "Door closed", 1_784_167_388_000, "7/16/2026 2:03:08 AM"),
    event(CLULOW, "Door opened", 1_784_168_158_000, "7/16/2026 2:15:58 AM"),
    event(CLULOW, "Door closed", 1_784_168_163_000, "7/16/2026 2:16:03 AM"),
    event(CLULOW, "Door opened", 1_784_168_163_000, "7/16/2026 2:16:03 AM"),
    event(CLULOW, "Door closed", 1_784_168_163_000, "7/16/2026 2:16:03 AM"),
  ];

  it("reports a maximum open duration of 9 seconds", () => {
    const sessions = pairDoorOpenCloseSessions(clulowEvents);
    const maxDuration = sessions.reduce(
      (max, session) => Math.max(max, session.durationSeconds),
      0,
    );

    expect(maxDuration).toBe(9);
  });

  it("does not produce held-open incidents above 30 seconds", () => {
    const incidents = buildComplianceIncidents(clulowEvents, {
      heldOpenThresholdSeconds: 30,
    });

    expect(incidents).toHaveLength(0);
  });
});

describe("buildIncidentsByDoorFromImportGroups", () => {
  it("does not pair an open from one import with a close from another", () => {
    const importA = "import-a";
    const importB = "import-b";

    const eventsByImportId = new Map<string, ParsedFireExitEvent[]>([
      [
        importA,
        [event(DOOR_A, "Door opened", 0, "open-import-a")],
      ],
      [
        importB,
        [event(DOOR_A, "Door closed", 120_000, "close-import-b")],
      ],
    ]);

    const incidentsByDoor = buildIncidentsByDoorFromImportGroups(eventsByImportId, {
      heldOpenThresholdSeconds: 30,
    });

    expect(incidentsByDoor.get(DOOR_A) ?? []).toHaveLength(0);
  });

  it("deduplicates repeated events across overlapping imports", () => {
    const sharedOpen = event(CLULOW, "Door opened", 1000, "shared-open");
    const sharedClose = event(CLULOW, "Door closed", 4000, "shared-close");
    const eventsByImportId = new Map<string, ParsedFireExitEvent[]>([
      ["import-a", [sharedOpen, sharedClose]],
      ["import-b", [sharedOpen, sharedClose]],
    ]);

    const deduped = dedupeParsedEvents([...eventsByImportId.values()].flat());
    expect(deduped).toHaveLength(2);

    const incidentsByDoor = buildIncidentsByDoorFromImportGroups(eventsByImportId, {
      heldOpenThresholdSeconds: 30,
    });

    expect(incidentsByDoor.get(CLULOW) ?? []).toHaveLength(0);
  });

  it("keeps valid incidents that occur entirely within one import", () => {
    const eventsByImportId = new Map<string, ParsedFireExitEvent[]>([
      [
        "import-a",
        [
          event(DOOR_A, "Door opened", 0, "open"),
          event(DOOR_A, "Door open too long", 40_000, "held"),
          event(DOOR_A, "Door closed", 70_000, "close"),
        ],
      ],
    ]);

    const incidentsByDoor = buildIncidentsByDoorFromImportGroups(eventsByImportId, {
      heldOpenThresholdSeconds: 30,
    });

    expect(incidentsByDoor.get(DOOR_A)).toHaveLength(1);
  });
});

describe("groupEventsByDoor isolation", () => {
  it("groups interleaved events by door before pairing", () => {
    const events = [
      event(DOOR_A, "Door opened", 0, "a-open"),
      event(DOOR_B, "Door opened", 1000, "b-open"),
      event(DOOR_A, "Door closed", 6000, "a-close"),
      event(DOOR_B, "Door closed", 9000, "b-close"),
    ];

    const grouped = groupEventsByDoor(events);
    const sessionsA = pairDoorOpenCloseSessions(grouped.get(DOOR_A) ?? []);
    const sessionsB = pairDoorOpenCloseSessions(grouped.get(DOOR_B) ?? []);

    expect(sessionsA[0]?.durationSeconds).toBe(6);
    expect(sessionsB[0]?.durationSeconds).toBe(8);
  });
});
