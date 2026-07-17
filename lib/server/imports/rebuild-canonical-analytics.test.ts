import { describe, expect, it } from "vitest";
import { buildCanonicalIncidentsByDoor } from "@/lib/analytics/canonical-incident-engine";
import { dedupeIncidents } from "@/lib/analytics/dedupe-parsed-events";
import {
  attributeIncidentToImportId,
  filterIncidentsByDoorForImport,
} from "@/lib/server/imports/rebuild-canonical-analytics";
import type { ParsedFireExitEvent } from "@/lib/analytics/types";

const DOOR = "Door A";

function event(
  importId: string,
  type: string,
  timestamp: number,
  sequence: number,
): ParsedFireExitEvent {
  return {
    door: DOOR,
    eventType: type,
    eventTime: new Date(timestamp).toISOString(),
    timestamp,
    csvDurationSeconds: null,
    sourceImportId: importId,
    sourceSequence: sequence,
  };
}

describe("rebuild-canonical-analytics attribution", () => {
  it("keeps stored deduped counts aligned with live canonical totals", () => {
    const importA = "import-a";
    const importB = "import-b";

    const canonical = buildCanonicalIncidentsByDoor({
      eventsByImportId: new Map([
        [
          importA,
          [
            event(importA, "Door opened", 0, 0),
            event(importA, "Door closed", 600_000, 1),
          ],
        ],
        [
          importB,
          [
            event(importB, "Door opened", 1_000_000, 0),
            event(importB, "Door closed", 1_600_000, 1),
          ],
        ],
      ]),
      importContexts: new Map([
        [
          importA,
          {
            importId: importA,
            reportingPeriodStart: new Date(0).toISOString(),
            reportingPeriodEnd: new Date(600_000).toISOString(),
            createdAt: new Date(0).toISOString(),
          },
        ],
        [
          importB,
          {
            importId: importB,
            reportingPeriodStart: new Date(0).toISOString(),
            reportingPeriodEnd: new Date(600_000).toISOString(),
            createdAt: new Date(0).toISOString(),
          },
        ],
      ]),
      config: { heldOpenThresholdSeconds: 30 },
      includeTrace: true,
    });

    const live = canonical.incidentsByDoor.get(DOOR) ?? [];
    const storedRows = [importA, importB].flatMap((importId) =>
      filterIncidentsByDoorForImport(canonical.incidentsByDoor, importId).get(
        DOOR,
      ) ?? [],
    );

    expect(storedRows).toHaveLength(2);
    expect(dedupeIncidents(storedRows)).toHaveLength(live.length);
    expect(attributeIncidentToImportId(live[0]!)).toBeTruthy();
  });
});
