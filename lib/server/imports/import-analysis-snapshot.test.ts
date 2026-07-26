import { describe, expect, it } from "vitest";
import { toClientImportAnalysisSnapshot } from "@/lib/server/imports/import-analysis-snapshot";
import type { ImportAnalysisSnapshot } from "@/lib/imports/types";

describe("toClientImportAnalysisSnapshot", () => {
  it("omits parsedEvents from client snapshots", () => {
    const snapshot = {
      mapping: {
        eventTime: "Event timestamp",
        eventType: "Event",
        doorName: "Door",
        cardholderName: "",
        cardholderEmail: "",
        credentialNumber: "",
        accessResult: "",
        siteBuilding: "",
      },
      analyzedRowCount: 1,
      intelligence: {
        config: { heldOpenThresholdSeconds: 30 },
        mapping: {},
        sourceFileName: "test.csv",
        analyzedRowCount: 1,
        analyzedAt: "2026-01-01T00:00:00.000Z",
        doors: [],
        summary: {
          totalDoors: 0,
          doorsWithViolations: 0,
          totalFireExitEvents: 0,
          totalHeldOpenEvents: 0,
          totalExposureSeconds: 0,
          totalExposureLabel: "0s",
          overallComplianceScore: 100,
          excellentDoors: 0,
          doorsNeedingAttention: 0,
          criticalDoors: 0,
          worstDoor: "N/A",
          hasDurationField: false,
        },
      },
      parsedEvents: [
        {
          door: "Door A",
          eventType: "Door opened",
          eventTime: "t",
          timestamp: 1,
          csvDurationSeconds: null,
        },
      ],
    } satisfies ImportAnalysisSnapshot;

    const clientSnapshot = toClientImportAnalysisSnapshot(snapshot);

    expect(clientSnapshot.parsedEvents).toBeUndefined();
    expect(clientSnapshot.intelligence).toBeDefined();
  });
});
