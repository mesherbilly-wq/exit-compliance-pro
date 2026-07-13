import type { FieldMapping } from "@/lib/imports/types";
import { buildExecutiveReport, type ExecutiveReport } from "@/lib/analytics/executive-report";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import { normalizeIntelligenceReport } from "@/lib/analytics/normalize-intelligence";
import {
  filterEventsByTimestamp,
  getEventTimestampBounds,
  refineLastImportBounds,
  resolveTrendsPeriodBounds,
  validateCustomTrendsRange,
  type TrendsPeriodPreset,
} from "@/lib/analytics/trends-period";
import type { FireExitAnalyticsConfig, ParsedFireExitEvent } from "@/lib/analytics/types";
import { loadParsedEventsGroupedByImports } from "@/lib/server/db/import-analytics-repository";
import { listImportsForAnalytics } from "@/lib/server/db/latest-import";

export type BuildExecutiveReportForExportInput = {
  config?: FireExitAnalyticsConfig;
  period?: TrendsPeriodPreset;
  customStart?: string | null;
  customEnd?: string | null;
};

export type BuildExecutiveReportForExportResult =
  | {
      ok: true;
      report: ExecutiveReport;
      reportingPeriodLabel: string;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 404 | 500;
    };

function selectEventsForPeriod(
  allEvents: ParsedFireExitEvent[],
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
  bounds: NonNullable<
    ReturnType<typeof resolveTrendsPeriodBounds>["bounds"]
  >,
): ParsedFireExitEvent[] {
  if (bounds.preset === "last-import" && bounds.importId) {
    return eventsByImportId.get(bounds.importId) ?? [];
  }

  return filterEventsByTimestamp(allEvents, bounds.startMs, bounds.endMs);
}

export async function buildExecutiveReportForExport(
  input: BuildExecutiveReportForExportInput = {},
): Promise<BuildExecutiveReportForExportResult> {
  const config = input.config ?? DEFAULT_ANALYTICS_CONFIG;
  const imports = await listImportsForAnalytics();

  if (imports.length === 0) {
    return {
      ok: false,
      error: "No processed imports are available to generate a management review.",
      status: 404,
    };
  }

  const importIds = imports.map((record) => record.id);
  const { allEvents, eventsByImportId } =
    await loadParsedEventsGroupedByImports(importIds);
  const { startMs, endMs } = getEventTimestampBounds(allEvents);

  if (startMs === null || endMs === null || allEvents.length === 0) {
    return {
      ok: false,
      error: "No parsed import events are available for PDF generation.",
      status: 404,
    };
  }

  const importRefs = imports.map((record) => ({
    id: record.id,
    createdAt: record.created_at,
    fileName: record.file_name,
  }));

  if (input.period === "custom") {
    const validation = validateCustomTrendsRange(
      input.customStart ?? "",
      input.customEnd ?? "",
    );

    if (!validation.valid) {
      return {
        ok: false,
        error: validation.message ?? "Invalid custom reporting period.",
        status: 400,
      };
    }
  }

  const resolved = resolveTrendsPeriodBounds({
    preset: input.period ?? "all-time",
    customStart: input.customStart,
    customEnd: input.customEnd,
    dataStartMs: startMs,
    dataEndMs: endMs,
    imports: importRefs,
  });

  if (!resolved.bounds) {
    return {
      ok: false,
      error: "Unable to resolve the requested reporting period.",
      status: 400,
    };
  }

  let bounds = resolved.bounds;
  if (bounds.preset === "last-import" && bounds.importId) {
    bounds = refineLastImportBounds(
      bounds,
      eventsByImportId.get(bounds.importId) ?? [],
    );
  }

  const periodEvents = selectEventsForPeriod(allEvents, eventsByImportId, bounds);

  if (periodEvents.length === 0) {
    return {
      ok: false,
      error: "No import data exists for the selected reporting period.",
      status: 404,
    };
  }

  const primaryImport = imports.at(-1)!;
  const mapping = (primaryImport.field_mapping ?? {}) as FieldMapping;
  const totalRowCount = imports.reduce((sum, record) => sum + record.row_count, 0);
  const hasDurationField = imports.some((record) => record.has_duration_field);

  const intelligence = normalizeIntelligenceReport(
    runFireExitIntelligenceFromParsedEvents(
      periodEvents,
      primaryImport.headers,
      [],
      {
        sourceFileName:
          imports.length === 1
            ? primaryImport.file_name
            : `Accumulated (${imports.length} imports)`,
        config,
        analyzedRowCount: totalRowCount,
        hasDurationField,
        mapping,
      },
    ).report,
  );

  const report = buildExecutiveReport(intelligence);

  return {
    ok: true,
    report,
    reportingPeriodLabel: bounds.label,
  };
}
