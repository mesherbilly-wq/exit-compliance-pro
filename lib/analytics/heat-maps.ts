import type { CsvRow, FieldMapping } from "@/lib/imports/types";
import { formatDurationLabel, formatDurationReadable } from "@/lib/reports/held-open-detection";
import { TIME_BEYOND_THRESHOLD_LABEL } from "@/lib/analytics/labels";
import { normalizeIntelligenceReport } from "./normalize-intelligence";
import { getRiskRating } from "./door-intelligence-view";
import type { ComplianceIncident, FireExitIntelligenceReport, RiskRating } from "./types";

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
  valueUnit: "incidents" | "sessions" | "seconds" | "score";
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
  totalIncidents: number;
  totalSessions: number;
  doorsWithIncidents: number;
  totalExposureSeconds: number;
};

type EnrichedIncident = ComplianceIncident & { building: string };

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

function enrichIncidents(
  report: FireExitIntelligenceReport,
  doorBuildingMap: Map<string, string>,
): EnrichedIncident[] {
  const incidents: EnrichedIncident[] = [];

  for (const profile of normalizeIntelligenceReport(report).doors) {
    const building = doorBuildingMap.get(profile.door) ?? "Unassigned";
    for (const incident of profile.incidents) {
      incidents.push({ ...incident, building });
    }
  }

  return incidents;
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

function passesIncidentFilters(
  incident: EnrichedIncident,
  filters: HeatMapFilterState,
  doorRiskMap: Map<string, RiskRating>,
): boolean {
  if (filters.door !== "All" && incident.door !== filters.door) {
    return false;
  }

  if (filters.building !== "All" && incident.building !== filters.building) {
    return false;
  }

  if (
    filters.riskLevel !== "All" &&
    doorRiskMap.get(incident.door) !== filters.riskLevel
  ) {
    return false;
  }

  return passesDateFilter(incident.startTimestamp, filters);
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
  incidents: EnrichedIncident[],
  doorBuildingMap: Map<string, string>,
  doorRiskMap: Map<string, RiskRating>,
): HeatMapFilterOptions {
  const doors = [...new Set(incidents.map((incident) => incident.door))].sort(
    (a, b) => a.localeCompare(b),
  );
  const buildings = [
    ...new Set([
      ...doorBuildingMap.values(),
      ...incidents.map((incident) => incident.building),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const dates = incidents
    .map((incident) => dateKey(incident.startTimestamp))
    .sort();
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

function buildHourOfDayGrid(incidents: EnrichedIncident[]): HeatMapGrid {
  const values = Array.from({ length: 24 }, () => 0);

  for (const incident of incidents) {
    values[incident.hourStarted] += 1;
  }

  const labels = values.map((_, hour) => `${String(hour).padStart(2, "0")}:00`);

  return buildSingleRowGrid(
    "hour-of-day",
    "Hour of day heat map",
    "Compliance incidents by the hour each incident started. Reminder events merged into one incident.",
    labels,
    values,
    "incidents",
    (value) => `${value.toLocaleString()} incident${value === 1 ? "" : "s"}`,
  );
}

function buildDayOfWeekGrid(incidents: EnrichedIncident[]): HeatMapGrid {
  const values = Array.from({ length: 7 }, () => 0);

  for (const incident of incidents) {
    const dayIndex = DAY_LABELS.indexOf(incident.dayStarted);
    if (dayIndex === -1) {
      continue;
    }

    values[dayIndex] += 1;
  }

  return buildSingleRowGrid(
    "day-of-week",
    "Day of week heat map",
    "Compliance incidents by weekday based on incident start day.",
    DAY_LABELS,
    values,
    "incidents",
    (value) => `${value.toLocaleString()} incident${value === 1 ? "" : "s"}`,
  );
}

function buildDoorActivityGrid(incidents: EnrichedIncident[]): HeatMapGrid {
  const doors = [...new Set(incidents.map((incident) => incident.door))].sort(
    (a, b) => a.localeCompare(b),
  );
  const colLabels = Array.from({ length: 24 }, (_, hour) =>
    `${String(hour).padStart(2, "0")}:00`,
  );
  const values = doors.map(() => Array.from({ length: 24 }, () => 0));

  for (const incident of incidents) {
    const rowIndex = doors.indexOf(incident.door);
    if (rowIndex === -1) {
      continue;
    }

    values[rowIndex][incident.hourStarted] += 1;
  }

  return buildMatrixGrid(
    "door-activity",
    "Door activity heat map",
    "Incident counts per door and incident start hour. Rows are doors, columns are hours of day.",
    doors,
    colLabels,
    values,
    "incidents",
    (value) => `${value.toLocaleString()} incident${value === 1 ? "" : "s"}`,
  );
}

function buildExposureTimeGrid(incidents: EnrichedIncident[]): HeatMapGrid {
  const doors = [...new Set(incidents.map((incident) => incident.door))].sort(
    (a, b) => a.localeCompare(b),
  );
  const values = doors.map(() => Array.from({ length: 7 }, () => 0));

  for (const incident of incidents) {
    const rowIndex = doors.indexOf(incident.door);
    if (rowIndex === -1) {
      continue;
    }

    const dayIndex = DAY_LABELS.indexOf(incident.dayStarted);
    if (dayIndex === -1) {
      continue;
    }

    values[rowIndex][dayIndex] += incident.timeBeyondThresholdSeconds;
  }

  return buildMatrixGrid(
    "exposure-time",
    `${TIME_BEYOND_THRESHOLD_LABEL} heat map`,
    "Time beyond threshold per door and weekday from session analytics.",
    doors,
    DAY_LABELS,
    values,
    "seconds",
    (value) => formatDurationReadable(value),
  );
}

function buildHighRiskDoorGrid(
  incidents: EnrichedIncident[],
  doorRiskMap: Map<string, RiskRating>,
): HeatMapGrid {
  const highRiskDoors = [
    ...new Set(
      incidents
        .map((incident) => incident.door)
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

  for (const incident of incidents) {
    const risk = doorRiskMap.get(incident.door);
    if (risk !== "High" && risk !== "Critical") {
      continue;
    }

    const rowIndex = highRiskDoors.indexOf(incident.door);
    if (rowIndex === -1) {
      continue;
    }

    values[rowIndex][incident.hourStarted] +=
      incident.timeBeyondThresholdSeconds;
  }

  return buildMatrixGrid(
    "high-risk-doors",
    "High risk door heat map",
    "Time beyond threshold for High and Critical risk doors by hour of day.",
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
  _headers: string[],
  filters: HeatMapFilterState = DEFAULT_HEAT_MAP_FILTERS,
): HeatMapDashboard {
  const normalizedReport = normalizeIntelligenceReport(report);
  const doorBuildingMap = buildDoorBuildingMap(rows, normalizedReport.mapping);
  const doorRiskMap = buildDoorRiskMap(normalizedReport);
  const allIncidents = enrichIncidents(normalizedReport, doorBuildingMap);

  const filteredIncidents = allIncidents.filter((incident) =>
    passesIncidentFilters(incident, filters, doorRiskMap),
  );

  const filterOptions = getFilterOptions(
    allIncidents,
    doorBuildingMap,
    doorRiskMap,
  );

  return {
    sourceFileName: normalizedReport.sourceFileName,
    filters,
    filterOptions,
    hourOfDay: buildHourOfDayGrid(filteredIncidents),
    dayOfWeek: buildDayOfWeekGrid(filteredIncidents),
    doorActivity: buildDoorActivityGrid(filteredIncidents),
    exposureTime: buildExposureTimeGrid(filteredIncidents),
    highRiskDoors: buildHighRiskDoorGrid(filteredIncidents, doorRiskMap),
    totalIncidents: filteredIncidents.length,
    totalSessions: filteredIncidents.length,
    doorsWithIncidents: new Set(filteredIncidents.map((incident) => incident.door))
      .size,
    totalExposureSeconds: filteredIncidents.reduce(
      (sum, incident) => sum + incident.timeBeyondThresholdSeconds,
      0,
    ),
  };
}
