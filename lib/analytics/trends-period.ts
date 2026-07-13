import type { ParsedFireExitEvent } from "./types";

export type TrendsPeriodPreset =
  | "last-import"
  | "last-24-hours"
  | "last-7-days"
  | "last-30-days"
  | "all-time"
  | "custom";

export type TrendsGrouping = "hour" | "day" | "week" | "month";

export type TrendsImportRef = {
  id: string;
  createdAt: string;
  fileName: string;
};

export type TrendsPeriodBounds = {
  preset: TrendsPeriodPreset;
  label: string;
  startMs: number;
  endMs: number;
  comparisonStartMs: number | null;
  comparisonEndMs: number | null;
  comparisonAvailable: boolean;
  comparisonLabel: string | null;
  grouping: TrendsGrouping;
  importId: string | null;
  previousImportId: string | null;
};

export type CustomRangeValidation = {
  valid: boolean;
  message: string | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;

export function validateCustomTrendsRange(
  startDate: string,
  endDate: string,
): CustomRangeValidation {
  if (!startDate.trim() || !endDate.trim()) {
    return {
      valid: false,
      message: "Both start and end dates are required for a custom range.",
    };
  }

  const startMs = parseDateInputStart(startDate);
  const endMs = parseDateInputEnd(endDate);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return {
      valid: false,
      message: "Enter valid start and end dates.",
    };
  }

  if (endMs < startMs) {
    return {
      valid: false,
      message: "End date cannot be before start date.",
    };
  }

  return { valid: true, message: null };
}

export function getDefaultTrendsPreset(dataSpanMs: number): TrendsPeriodPreset {
  return dataSpanMs >= 7 * MS_DAY ? "last-7-days" : "all-time";
}

export function chooseGroupingForRange(
  preset: TrendsPeriodPreset,
  rangeMs: number,
): TrendsGrouping {
  if (preset === "last-24-hours") {
    return "hour";
  }

  if (preset === "last-7-days" || preset === "last-30-days") {
    return "day";
  }

  if (preset === "last-import") {
    if (rangeMs <= 2 * MS_DAY) {
      return "hour";
    }

    if (rangeMs <= 35 * MS_DAY) {
      return "day";
    }

    if (rangeMs <= 180 * MS_DAY) {
      return "week";
    }

    return "month";
  }

  if (preset === "custom") {
    if (rangeMs <= 2 * MS_DAY) {
      return "hour";
    }

    if (rangeMs <= 35 * MS_DAY) {
      return "day";
    }

    if (rangeMs <= 180 * MS_DAY) {
      return "week";
    }

    return "month";
  }

  if (rangeMs <= 90 * MS_DAY) {
    return "week";
  }

  return "month";
}

export function resolveTrendsPeriodBounds(input: {
  preset: TrendsPeriodPreset;
  customStart?: string | null;
  customEnd?: string | null;
  nowMs?: number;
  dataStartMs: number | null;
  dataEndMs: number | null;
  imports: TrendsImportRef[];
}): { bounds: TrendsPeriodBounds | null; validation: CustomRangeValidation | null } {
  const nowMs = input.nowMs ?? Date.now();
  const dataStartMs = input.dataStartMs;
  const dataEndMs = input.dataEndMs ?? nowMs;

  if (dataStartMs === null || !Number.isFinite(dataStartMs)) {
    return { bounds: null, validation: null };
  }

  if (input.preset === "custom") {
    const validation = validateCustomTrendsRange(
      input.customStart ?? "",
      input.customEnd ?? "",
    );

    if (!validation.valid) {
      return { bounds: null, validation };
    }

    const startMs = parseDateInputStart(input.customStart!);
    const endMs = parseDateInputEnd(input.customEnd!);
    const durationMs = endMs - startMs + 1;
    const comparisonEndMs = startMs - 1;
    const comparisonStartMs = comparisonEndMs - durationMs + 1;

    return {
      bounds: {
        preset: "custom",
        label: formatRangeLabel(startMs, endMs),
        startMs,
        endMs,
        comparisonStartMs,
        comparisonEndMs,
        comparisonAvailable: comparisonStartMs >= dataStartMs,
        comparisonLabel: formatRangeLabel(comparisonStartMs, comparisonEndMs),
        grouping: chooseGroupingForRange("custom", durationMs),
        importId: null,
        previousImportId: null,
      },
      validation: null,
    };
  }

  if (input.preset === "last-import") {
    const latest = input.imports.at(-1);
    if (!latest) {
      return { bounds: null, validation: null };
    }

    const previous = input.imports.at(-2) ?? null;

    return {
      bounds: {
        preset: "last-import",
        label: `Last import — ${latest.fileName}`,
        startMs: dataStartMs,
        endMs: dataEndMs,
        comparisonStartMs: null,
        comparisonEndMs: null,
        comparisonAvailable: previous !== null,
        comparisonLabel: previous
          ? `Previous import — ${previous.fileName}`
          : null,
        grouping: chooseGroupingForRange("last-import", dataEndMs - dataStartMs),
        importId: latest.id,
        previousImportId: previous?.id ?? null,
      },
      validation: null,
    };
  }

  if (input.preset === "all-time") {
    return {
      bounds: {
        preset: "all-time",
        label: "All time",
        startMs: dataStartMs,
        endMs: dataEndMs,
        comparisonStartMs: null,
        comparisonEndMs: null,
        comparisonAvailable: false,
        comparisonLabel: null,
        grouping: chooseGroupingForRange("all-time", dataEndMs - dataStartMs),
        importId: null,
        previousImportId: null,
      },
      validation: null,
    };
  }

  const durationMs =
    input.preset === "last-24-hours"
      ? MS_DAY
      : input.preset === "last-7-days"
        ? 7 * MS_DAY
        : 30 * MS_DAY;

  const endMs = Math.min(dataEndMs, nowMs);
  const startMs = Math.max(dataStartMs, endMs - durationMs + 1);
  const comparisonEndMs = startMs - 1;
  const comparisonStartMs = comparisonEndMs - durationMs + 1;

  const presetLabel =
    input.preset === "last-24-hours"
      ? "Last 24 hours"
      : input.preset === "last-7-days"
        ? "Last 7 days"
        : "Last 30 days";

  return {
    bounds: {
      preset: input.preset,
      label: presetLabel,
      startMs,
      endMs,
      comparisonStartMs,
      comparisonEndMs,
      comparisonAvailable: comparisonStartMs >= dataStartMs,
      comparisonLabel: comparisonAvailableLabel(
        comparisonStartMs,
        comparisonEndMs,
        comparisonStartMs >= dataStartMs,
      ),
      grouping: chooseGroupingForRange(input.preset, durationMs),
      importId: null,
      previousImportId: null,
    },
    validation: null,
  };
}

function comparisonAvailableLabel(
  comparisonStartMs: number,
  comparisonEndMs: number,
  available: boolean,
): string | null {
  if (!available) {
    return null;
  }

  return formatRangeLabel(comparisonStartMs, comparisonEndMs);
}

export function parseDateInputStart(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

export function parseDateInputEnd(value: string): number {
  return new Date(`${value}T23:59:59.999`).getTime();
}

export function formatRangeLabel(startMs: number, endMs: number): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${formatter.format(new Date(startMs))} – ${formatter.format(new Date(endMs))}`;
}

export function filterEventsByTimestamp<T extends { timestamp: number }>(
  events: T[],
  startMs: number,
  endMs: number,
): T[] {
  return events.filter(
    (event) =>
      Number.isFinite(event.timestamp) &&
      event.timestamp >= startMs &&
      event.timestamp <= endMs,
  );
}

export function refineLastImportBounds(
  bounds: TrendsPeriodBounds,
  importEvents: ParsedFireExitEvent[],
): TrendsPeriodBounds {
  if (bounds.preset !== "last-import" || importEvents.length === 0) {
    return bounds;
  }

  const timestamps = importEvents
    .map((event) => event.timestamp)
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return bounds;
  }

  const startMs = Math.min(...timestamps);
  const endMs = Math.max(...timestamps);

  return {
    ...bounds,
    startMs,
    endMs,
    label: `${bounds.label} (${formatRangeLabel(startMs, endMs)})`,
    grouping: chooseGroupingForRange("last-import", endMs - startMs),
  };
}

export function getEventTimestampBounds(events: ParsedFireExitEvent[]): {
  startMs: number | null;
  endMs: number | null;
} {
  const timestamps = events
    .map((event) => event.timestamp)
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return { startMs: null, endMs: null };
  }

  return {
    startMs: Math.min(...timestamps),
    endMs: Math.max(...timestamps),
  };
}
