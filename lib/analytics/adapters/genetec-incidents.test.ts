import { describe, expect, it } from "vitest";
import { buildGenetecComplianceIncidents } from "./genetec-incidents";
import { buildCanonicalIncidentsByDoor } from "../canonical-incident-engine";
import { buildComplianceIncidents } from "../compliance-incidents";
import { dedupeParsedEvents } from "../dedupe-parsed-events";
import type { ParsedFireExitEvent } from "../types";

const DOOR = "Ground - Adj David Clulow";
const THRESHOLD = 300;

function event(
  eventType: string,
  timestamp: number,
  extras?: Partial<ParsedFireExitEvent>,
): ParsedFireExitEvent {
  return {
    door: DOOR,
    eventType,
    eventTime: new Date(timestamp).toISOString(),
    timestamp,
    csvDurationSeconds: null,
    sourceSystem: "genetec",
    ...extras,
  };
}

describe("Genetec native-alarm-only incident policy", () => {
  it("ignores open/close over threshold without a native held-open alarm", () => {
    const incidents = buildGenetecComplianceIncidents(
      [
        event("Door opened", 0, { sourceSequence: 0 }),
        event("Door closed", 600_000, { sourceSequence: 1 }),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(0);
  });

  it("counts open/close over threshold when a matching native held-open alarm exists", () => {
    const incidents = buildGenetecComplianceIncidents(
      [
        event("Door opened", 0, { sourceSequence: 0 }),
        event("Door held open", 360_000, { sourceSequence: 1 }),
        event("Door closed", 600_000, { sourceSequence: 2 }),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.classification).toBe("native_held_open_alarm");
    expect(incidents[0]?.eventType).toBe("Door held open");
    expect(incidents[0]?.durationSeconds).toBe(600);
  });

  it("counts native door open too long alarms with matching close", () => {
    const incidents = buildGenetecComplianceIncidents(
      [
        event("Door opened", 0, { sourceSequence: 0 }),
        event("Door open too long", 400_000, { sourceSequence: 1 }),
        event("Door closed", 700_000, { sourceSequence: 2 }),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.eventType).toBe("Door open too long");
    expect(incidents[0]?.durationSeconds).toBe(700);
  });

  it("handles native held-open alarm without a close safely", () => {
    const incidents = buildGenetecComplianceIncidents(
      [
        event("Door opened", 0, { sourceSequence: 0 }),
        event("Door held open", 400_000, { sourceSequence: 1 }),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.endTimestamp).toBe(400_000);
    expect(incidents[0]?.classification).toBe("native_held_open_alarm");
  });

  it("matches held-open alarms to the correct session on the same door", () => {
    const incidents = buildGenetecComplianceIncidents(
      [
        event("Door opened", 0, { sourceSequence: 0 }),
        event("Door closed", 20_000, { sourceSequence: 1 }),
        event("Door opened", 30_000, { sourceSequence: 2 }),
        event("Door held open", 360_000, { sourceSequence: 3 }),
        event("Door closed", 600_000, { sourceSequence: 4 }),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.startTimestamp).toBeGreaterThanOrEqual(330_000);
    expect(incidents[0]?.durationSeconds).toBe(570);
  });

  it("deduplicates duplicate native alarms across overlapping imports", () => {
    const alarm = event("Door held open", 400_000, { sourceSequence: 1 });
    const open = event("Door opened", 0, { sourceSequence: 0 });
    const close = event("Door closed", 700_000, { sourceSequence: 2 });
    const eventsByImportId = new Map([
      ["import-a", [open, alarm, close]],
      ["import-b", [open, alarm, close]],
    ]);

    expect(dedupeParsedEvents([...eventsByImportId.values()].flat())).toHaveLength(
      3,
    );

    const incidents = buildCanonicalIncidentsByDoor({
      eventsByImportId,
      config: { heldOpenThresholdSeconds: THRESHOLD },
    }).incidentsByDoor.get(DOOR);

    expect(incidents).toHaveLength(1);
  });

  it("does not create derived threshold incidents for Genetec via buildComplianceIncidents", () => {
    const incidents = buildComplianceIncidents(
      [
        event("Door opened", 0),
        event("Door closed", 600_000),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(0);
  });

  it("leaves non-Genetec sources on open/close derived incident rules", () => {
    const incidents = buildComplianceIncidents(
      [
        {
          door: "Manual Door",
          eventType: "Door opened",
          eventTime: "open",
          timestamp: 0,
          csvDurationSeconds: null,
          sourceSystem: "manual",
        },
        {
          door: "Manual Door",
          eventType: "Door closed",
          eventTime: "close",
          timestamp: 600_000,
          csvDurationSeconds: null,
          sourceSystem: "manual",
        },
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.classification).toBe("derived_open_duration");
    expect(incidents[0]?.eventType).toBe("Open beyond configured threshold");
  });

  it("ignores Clulow Jul 9 over-threshold session without native alarm", () => {
    const tsOpen1 = 1783584575000;
    const tsOpen2 = 1783584579000;
    const tsClose = 1783585100000;

    const incidents = buildComplianceIncidents(
      [
        event("Door opened", tsOpen1, { sourceSequence: 0 }),
        event("Door closed", tsOpen2, { sourceSequence: 1 }),
        event("Door opened", tsOpen2, { sourceSequence: 2 }),
        event("Door closed", tsClose, { sourceSequence: 3 }),
      ],
      { heldOpenThresholdSeconds: THRESHOLD },
    );

    expect(incidents).toHaveLength(0);
  });
});
