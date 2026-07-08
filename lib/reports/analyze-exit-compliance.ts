import type { FieldMapping } from "@/lib/imports/types";

export type CsvRow = Record<string, string>;

export type ExitComplianceAnalysis = {
  totalEvents: number;
  uniqueDoors: number;
  forcedOpenEvents: number;
  heldOpenEvents: number;
  lifeSafetyExceptions: number;
  otherEvents: number;
  doorBreakdown: { door: string; count: number }[];
  recentExceptions: {
    time: string;
    type: string;
    door: string;
    result: string;
  }[];
};

function getFieldValue(row: CsvRow, mapping: FieldMapping, key: keyof FieldMapping) {
  const column = mapping[key];
  return column ? row[column]?.trim() ?? "" : "";
}

type EventCategory = "forcedOpenEvents" | "heldOpenEvents" | "otherEvents";

function classifyEvent(eventType: string, accessResult: string): EventCategory {
  const combined = `${eventType} ${accessResult}`.toLowerCase();

  if (combined.includes("forced") || combined.includes("force open")) {
    return "forcedOpenEvents";
  }

  if (combined.includes("held open") || combined.includes("held-open")) {
    return "heldOpenEvents";
  }

  return "otherEvents";
}

export function analyzeExitCompliance(
  rows: CsvRow[],
  mapping: FieldMapping,
): ExitComplianceAnalysis {
  const doorCounts = new Map<string, number>();
  const exceptions: ExitComplianceAnalysis["recentExceptions"] = [];

  let forcedOpenEvents = 0;
  let heldOpenEvents = 0;
  let otherEvents = 0;

  for (const row of rows) {
    const eventType = getFieldValue(row, mapping, "eventType");
    const doorName = getFieldValue(row, mapping, "doorName") || "Unknown exit door";
    const eventTime = getFieldValue(row, mapping, "eventTime");
    const accessResult = getFieldValue(row, mapping, "accessResult");

    doorCounts.set(doorName, (doorCounts.get(doorName) ?? 0) + 1);

    const category = classifyEvent(eventType, accessResult);

    if (category === "forcedOpenEvents") forcedOpenEvents += 1;
    if (category === "heldOpenEvents") heldOpenEvents += 1;
    if (category === "otherEvents") otherEvents += 1;

    if (category !== "otherEvents") {
      exceptions.push({
        time: eventTime || "—",
        type: eventType || "Unknown event",
        door: doorName,
        result:
          accessResult ||
          (category === "forcedOpenEvents" ? "Forced open" : "Held open"),
      });
    }
  }

  const doorBreakdown = [...doorCounts.entries()]
    .map(([door, count]) => ({ door, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEvents: rows.length,
    uniqueDoors: doorCounts.size,
    forcedOpenEvents,
    heldOpenEvents,
    lifeSafetyExceptions: forcedOpenEvents + heldOpenEvents,
    otherEvents,
    doorBreakdown,
    recentExceptions: exceptions.slice(0, 15),
  };
}

export function canRunExitComplianceAnalysis(
  rows: CsvRow[],
  mapping: FieldMapping | null,
): boolean {
  if (!mapping || rows.length === 0) return false;

  return (
    mapping.eventTime.trim() !== "" &&
    mapping.eventType.trim() !== "" &&
    mapping.doorName.trim() !== ""
  );
}
