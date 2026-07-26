import { describe, expect, it } from "vitest";
import { mergeDoorProfilesByName } from "@/lib/server/imports/merge-stored-door-profiles";
import type { DoorIntelligenceProfile } from "@/lib/analytics/types";

function profile(
  door: string,
  incidents: DoorIntelligenceProfile["incidents"],
  totalFireExitEvents: number,
): DoorIntelligenceProfile {
  return {
    door,
    totalFireExitEvents,
    totalIncidents: incidents.length,
    totalHeldOpenEvents: incidents.length,
    totalExposureSeconds: incidents.reduce(
      (sum, incident) => sum + incident.timeBeyondThresholdSeconds,
      0,
    ),
    totalExposureLabel: "0s",
    averageHeldOpenDurationSeconds: null,
    averageHeldOpenDurationLabel: "N/A",
    longestHeldOpenDurationSeconds: null,
    longestHeldOpenDurationLabel: "N/A",
    repeatOccurrences: incidents.length,
    daysAffected: 0,
    firstOccurrence: "N/A",
    lastOccurrence: "N/A",
    timeOfDayDistribution: [],
    dayOfWeekDistribution: [],
    weeklyTrend: [],
    monthlyTrend: [],
    complianceScore: 80,
    status: "Good",
    incidents,
    sessions: incidents,
  };
}

describe("mergeDoorProfilesByName", () => {
  it("deduplicates incidents and sums event counts for the same door", () => {
    const incident = {
      door: "Door A",
      startTimestamp: 1000,
      endTimestamp: 2000,
      startTimeLabel: "start",
      endTimeLabel: "end",
      durationSeconds: 1000,
      thresholdSeconds: 30,
      timeBeyondThresholdSeconds: 970,
      riskRating: "High" as const,
      durationBucket: "Extended" as const,
      dayStarted: "Mon",
      hourStarted: 8,
      isExplicitAlarm: true,
      classification: "native_held_open_alarm" as const,
      eventType: "Door held open",
    };

    const merged = mergeDoorProfilesByName([
      profile("Door A", [incident], 10),
      profile("Door A", [incident], 12),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.totalFireExitEvents).toBe(22);
    expect(merged[0]?.incidents).toHaveLength(1);
  });
});
