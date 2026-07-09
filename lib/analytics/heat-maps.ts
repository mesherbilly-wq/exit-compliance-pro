import type { CsvRow, FieldMapping } from "@/lib/imports/types";
import { formatDurationLabel, formatDurationReadable } from "@/lib/reports/held-open-detection";
import {
  getRiskRating,
  type RiskRating,
} from "./door-intelligence-view";
import { parseFireExitEvents } from "./parse-events";
import type {
  FireExitIntelligenceReport,
  HeldOpenSession,
  ParsedFireExitEvent,
} from "./types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type HeatMapFilterState = {
  dateFrom: string;
  dateTo: string;
  door: string;
  building: string;
  riskLevel: RiskRating | "All";
};

export type HeatMapCell = {
  row: number;
  col: number;
  rowLabel: string;
  colLabel: string;
  value: number;
  intensity: number;
  tooltip: string;
};

export type HeatMapGrid = {
  id: string;
  title: string;
  description: string;
  rowLabels: string[];
  colLabels: string[];
  cells: HeatMapCell[][];
  valueUnit: "events" | "sessions" | "seconds" | "score";
  maxValue: number;
};

export type HeatMapFilterOptions = {
  doors: string[];
  buildings: string[];
  dateRange: { min: string; max: string };
  riskLevels: RiskRating[];
};

export type HeatMapDashboard = {
  sourceFileName: string;
  filters: HeatMapFilterState;
  filterOptions: HeatMapFilterOptions;
  hourOfDay: HeatMapGrid;
  dayOfWeek: HeatMapGrid;
  doorActivity: HeatMapGrid;
  exposureTime: HeatMapGrid;
  highRiskDoors: HeatMapGrid;
  totalEvents: number;
  totalSessions: number;
  totalExposureSeconds: number;
};

type EnrichedEvent = ParsedFireExitEvent & { building: string };
type EnrichedSession = HeldOpenSession & { building: string };

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getFieldValue(
  row: CsvRow,
  mapping: FieldMapping,
  key: keyof FieldMapping,
): string {
  const column = mapping[key];
  return column ? row[column]?.trim() ?? "" : "";
}

export function buildDoorBuildingMap(
  rows: CsvRow[],
  mapping: FieldMapping,
): Map<string, string> {
  const doorBuilding = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const door =
      getFieldValue(row, mapping, "doorName") || "Unknown exit door";
    const building =
      getFieldValue(row, mapping, "siteBuilding") || "Unassigned";

    const counts = doorBuilding.get(door) ?? new Map<string, number>();
    counts.set(building, (counts.get(building) ?? 0) + 1);
    doorBuilding.set(door, counts);
  }

  const result = new Map<string, string>();
  for (const [door, counts] of doorBuilding) {
    const primary = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    result.set(door, primary ?? "Unassigned");
  }

  return result;
}

function buildDoorRiskMap(
  report: FireExitIntelligenceReport,
): Map<string, RiskRating> {
  const map = new Map<string, RiskRating>();
  for (const profile of report.doors) {
    map.set(profile.door, getRiskRating(profile));
  }
  return map;
}

function enrichEvents(
  events: ParsedFireExitEvent[],
  doorBuildingMap: Map<string, string>,
): EnrichedEvent[] {
  return events.map((event) => ({
    ...event,
    building: doorBuildingMap.get(event.door) ?? "Unassigned",
  }));
}

function enrichSessions(
  report: FireExitIntelligenceReport,
  doorBuildingMap: Map<string, string>,
): EnrichedSession[] {
  const sessions: EnrichedSession[] = [];

  for (const profile of report.doors) {
    const building = doorBuildingMap.get(profile.door) ?? "Unassigned";
    for (const session of profile.sessions) {
      sessions.push({ ...session, building });
    }
  }

  return sessions;
}

function passesDateFilter(
  timestamp: number,
  filters: HeatMapFilterState,
): boolean {
  const key = dateKey(timestamp);

  if (filters.dateFrom && key < filters.dateFrom) {
    return false;
  }

  if (filters.dateTo && key > filters.dateTo) {
    return false;
  }

  return true;
}

function passesEventFilters(
  event: EnrichedEvent,
  filters: HeatMapFilterState,
  doorRiskMap: Map<string, RiskRating>,
): boolean {
  if (filters.door !== "All" && event.door !== filters.door) {
    return false;
  }

  if (filters.building !== "All" && event.building !== filters.building) {
    return false;
  }

  if (
    filters.riskLevel !== "All" &&
    doorRiskMap.get(event.door) !== filters.riskLevel
  ) {
    return false;
  }

  return passesDateFilter(event.timestamp, filters);
}

function passesSessionFilters(
  session: EnrichedSession,
  filters: HeatMapFilterState,
  doorRiskMap: Map<string, RiskRating>,
): boolean {
  if (filters.door !== "All" && session.door !== filters.door) {
    return false;
  }

  if (filters.building !== "All" && session.building !== filters.building) {
    return false;
  }

  if (
    filters.riskLevel !== "All" &&
    doorRiskMap.get(session.door) !== filters.riskLevel
  ) {
    return false;
  }

  return passesDateFilter(session.startTimestamp, filters);
}

function normalizeIntensity(value: number, maxValue: number): number {
  if (maxValue <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(1, value / maxValue);
}

function buildMatrixGrid(
  id: string,
  title: string,
  description: string,
  rowLabels: string[],
  colLabels: string[],
  values: number[][],
  valueUnit: HeatMapGrid["valueUnit"],
  formatValue: (value: number) => string,
): HeatMapGrid {
  let maxValue = 0;

  for (const row of values) {
    for (const value of row) {
      if (value > maxValue) {
        maxValue = value;
      }
    }
  }

  const cells = values.map((row, rowIndex) =>
    row.map((value, colIndex) => ({
      row: rowIndex,
      col: colIndex,
      rowLabel: rowLabels[rowIndex] ?? "",
      colLabel: colLabels[colIndex] ?? "",
      value,
      intensity: normalizeIntensity(value, maxValue),
      tooltip: `${rowLabels[rowIndex] ?? ""} · ${colLabels[colIndex] ?? ""}: ${formatValue(value)}`,
    })),
  );

  return {
    id,
    title,
    description,
    rowLabels,
    colLabels,
    cells,
    valueUnit,
    maxValue,
  };
}

function buildSingleRowGrid(
  id: string,
  title: string,
  description: string,
  labels: string[],
  values: number[],
  valueUnit: HeatMapGrid["valueUnit"],
  formatValue: (value: number) => string,
): HeatMapGrid {
  return buildMatrixGrid(
    id,
    title,
    description,
    ["Activity"],
    labels,
    [values],
    valueUnit,
    formatValue,
  );
}

function getFilterOptions(
  events: EnrichedEvent[],
  doorBuildingMap: Map<string, string>,
  doorRiskMap: Map<string, RiskRating>,
): HeatMapFilterOptions {
  const doors = [...new Set(events.map((event) => event.door))].sort((a, b) =>
    a.localeCompare(b),
  );
  const buildings = [
    ...new Set([...doorBuildingMap.values(), ...events.map((e) => e.building)]),
  ].sort((a, b) => a.localeCompare(b));

  const dates = events.map((event) => dateKey(event.timestamp)).sort();
  const riskLevels = [...new Set(doorRiskMap.values())].sort((a, b) => {
    const order: Record<RiskRating, number> = {
      Low: 1,
      Medium: 2,
      High: 3,
      Critical: 4,
    };
    return order[a] - order[b];
  });

  return {
    doors,
    buildings,
    dateRange: {
      min: dates[0] ?? "",
      max: dates[dates.length - 1] ?? "",
    },
    riskLevels,
  };
}

function buildHourOfDayGrid(events: EnrichedEvent[]): HeatMapGrid {
  const values = Array.from({ length: 24 }, () => 0);

  for (const event of events) {
    const hour = new Date(event.timestamp).getHours();
    values[hour] += 1;
  }

  const labels = values.map((_, hour) => `${String(hour).padStart(2, "0")}:00`);

  return buildSingleRowGrid(
    "hour-of-day",
    "Hour of day heat map",
    "Fire exit event volume by hour. Darker cells indicate busier periods.",
    labels,
    values,
    "events",
    (value) => `${value.toLocaleString()} events`,
  );
}

function buildDayOfWeekGrid(events: EnrichedEvent[]): HeatMapGrid {
  const values = Array.from({ length: 7 }, () => 0);

  for (const event of events) {
    const day = new Date(event.timestamp).getDay();
    values[day] += 1;
  }

  return buildSingleRowGrid(
    "day-of-week",
    "Day of week heat map",
    "Fire exit event volume by weekday. Darker cells indicate busier days.",
    DAY_LABELS,
    values,
    "events",
    (value) => `${value.toLocaleString()} events`,
  );
}

function buildDoorActivityGrid(events: EnrichedEvent[]): HeatMapGrid {
  const doors = [...new Set(events.map((event) => event.door))].sort((a, b) =>
    a.localeCompare(b),
  );
  const colLabels = Array.from({ length: 24 }, (_, hour) =>
    `${String(hour).padStart(2, "0")}:00`,
  );
  const values = doors.map(() => Array.from({ length: 24 }, () => 0));

  for (const event of events) {
    const rowIndex = doors.indexOf(event.door);
    if (rowIndex === -1) {
      continue;
    }

    const hour = new Date(event.timestamp).getHours();
    values[rowIndex][hour] += 1;
  }

  return buildMatrixGrid(
    "door-activity",
    "Door activity heat map",
    "Event counts per door and hour. Rows are doors, columns are hours of day.",
    doors,
    colLabels,
    values,
    "events",
    (value) => `${value.toLocaleString()} events`,
  );
}

function buildExposureTimeGrid(sessions: EnrichedSession[]): HeatMapGrid {
  const doors = [...new Set(sessions.map((session) => session.door))].sort(
    (a, b) => a.localeCompare(b),
  );
  const values = doors.map(() => Array.from({ length: 7 }, () => 0));

  for (const session of sessions) {
    const rowIndex = doors.indexOf(session.door);
    if (rowIndex === -1) {
      continue;
    }

    const day = new Date(session.startTimestamp).getDay();
    values[rowIndex][day] += session.exposureSeconds;
  }

  return buildMatrixGrid(
    "exposure-time",
    "Exposure time heat map",
    "Held-open exposure seconds per door and weekday from session analytics.",
    doors,
    DAY_LABELS,
    values,
    "seconds",
    (value) => formatDurationReadable(value),
  );
}

function buildHighRiskDoorGrid(
  sessions: EnrichedSession[],
  doorRiskMap: Map<string, RiskRating>,
): HeatMapGrid {
  const highRiskDoors = [
    ...new Set(
      sessions
        .map((session) => session.door)
        .filter((door) => {
          const risk = doorRiskMap.get(door);
          return risk === "High" || risk === "Critical";
        }),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const colLabels = Array.from({ length: 24 }, (_, hour) =>
    `${String(hour).padStart(2, "0")}:00`,
  );
  const values = highRiskDoors.map(() => Array.from({ length: 24 }, () => 0));

  for (const session of sessions) {
    const risk = doorRiskMap.get(session.door);
    if (risk !== "High" && risk !== "Critical") {
      continue;
    }

    const rowIndex = highRiskDoors.indexOf(session.door);
    if (rowIndex === -1) {
      continue;
    }

    const hour = new Date(session.startTimestamp).getHours();
    values[rowIndex][hour] += session.exposureSeconds;
  }

  return buildMatrixGrid(
    "high-risk-doors",
    "High risk door heat map",
    "Exposure intensity for High and Critical risk doors by hour of day.",
    highRiskDoors.length > 0 ? highRiskDoors : ["No high risk doors"],
    colLabels,
    highRiskDoors.length > 0
      ? values
      : [Array.from({ length: 24 }, () => 0)],
    "seconds",
    (value) => formatDurationReadable(value),
  );
}

export const DEFAULT_HEAT_MAP_FILTERS: HeatMapFilterState = {
  dateFrom: "",
  dateTo: "",
  door: "All",
  building: "All",
  riskLevel: "All",
};

export function buildHeatMapDashboard(
  report: FireExitIntelligenceReport,
  rows: CsvRow[],
  headers: string[],
  filters: HeatMapFilterState = DEFAULT_HEAT_MAP_FILTERS,
): HeatMapDashboard {
  const doorBuildingMap = buildDoorBuildingMap(rows, report.mapping);
  const doorRiskMap = buildDoorRiskMap(report);
  const { events } = parseFireExitEvents(rows, report.mapping, headers);

  const allEvents = enrichEvents(events, doorBuildingMap);
  const allSessions = enrichSessions(report, doorBuildingMap);

  const filteredEvents = allEvents.filter((event) =>
    passesEventFilters(event, filters, doorRiskMap),
  );
  const filteredSessions = allSessions.filter((session) =>
    passesSessionFilters(session, filters, doorRiskMap),
  );

  const filterOptions = getFilterOptions(allEvents, doorBuildingMap, doorRiskMap);

  return {
    sourceFileName: report.sourceFileName,
    filters,
    filterOptions,
    hourOfDay: buildHourOfDayGrid(filteredEvents),
    dayOfWeek: buildDayOfWeekGrid(filteredEvents),
    doorActivity: buildDoorActivityGrid(filteredEvents),
    exposureTime: buildExposureTimeGrid(filteredSessions),
    highRiskDoors: buildHighRiskDoorGrid(filteredSessions, doorRiskMap),
    totalEvents: filteredEvents.length,
    totalSessions: filteredSessions.length,
    totalExposureSeconds: filteredSessions.reduce(
      (sum, session) => sum + session.exposureSeconds,
      0,
    ),
  };
}
