import type { FieldMapping } from "@/lib/imports/types";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import {
  buildTrendsDashboard,
  parseTrendsPeriodPreset,
  type TrendsDashboard,
} from "@/lib/analytics/trends-dashboard";
import {
  getDefaultTrendsPreset,
  getEventTimestampBounds,
  refineLastImportBounds,
  resolveTrendsPeriodBounds,
  type TrendsPeriodPreset,
} from "@/lib/analytics/trends-period";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";
import { loadParsedEventsGroupedByImports } from "@/lib/server/db/import-analytics-repository";
import {
  getEventLoadOptionsForRetention,
  listImportsForAnalytics,
} from "@/lib/server/db/latest-import";

export type TrendsApiResponse = {
  configured: boolean;
  defaultPreset: TrendsPeriodPreset | null;
  validationError: string | null;
  dashboard: TrendsDashboard | null;
  dataRange: {
    start: string | null;
    end: string | null;
  };
};

export async function buildTrendsApiResponse(input: {
  preset?: TrendsPeriodPreset;
  customStart?: string | null;
  customEnd?: string | null;
  config?: FireExitAnalyticsConfig;
}): Promise<TrendsApiResponse> {
  const config = input.config ?? DEFAULT_ANALYTICS_CONFIG;
  const imports = await listImportsForAnalytics(config);

  if (imports.length === 0) {
    return {
      configured: true,
      defaultPreset: null,
      validationError: null,
      dashboard: null,
      dataRange: { start: null, end: null },
    };
  }

  const importIds = imports.map((record) => record.id);
  const { allEvents, eventsByImportId } =
    await loadParsedEventsGroupedByImports(
      importIds,
      getEventLoadOptionsForRetention(config),
    );
  const { startMs, endMs } = getEventTimestampBounds(allEvents);

  if (startMs === null || endMs === null) {
    return {
      configured: true,
      defaultPreset: getDefaultTrendsPreset(0),
      validationError: null,
      dashboard: null,
      dataRange: { start: null, end: null },
    };
  }

  const dataSpanMs = endMs - startMs;
  const defaultPreset = getDefaultTrendsPreset(dataSpanMs);
  const preset = input.preset ?? defaultPreset;
  const importRefs = imports.map((record) => ({
    id: record.id,
    createdAt: record.created_at,
    fileName: record.file_name,
  }));
  const importContexts = new Map(
    imports.map((record) => [
      record.id,
      {
        importId: record.id,
        reportingPeriodStart: record.reporting_period_start,
        reportingPeriodEnd: record.reporting_period_end,
        createdAt: record.created_at,
      },
    ]),
  );

  const resolved = resolveTrendsPeriodBounds({
    preset,
    customStart: input.customStart,
    customEnd: input.customEnd,
    dataStartMs: startMs,
    dataEndMs: endMs,
    imports: importRefs,
  });

  if (resolved.validation && !resolved.validation.valid) {
    return {
      configured: true,
      defaultPreset,
      validationError: resolved.validation.message,
      dashboard: null,
      dataRange: {
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
      },
    };
  }

  if (!resolved.bounds) {
    return {
      configured: true,
      defaultPreset,
      validationError: null,
      dashboard: null,
      dataRange: {
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
      },
    };
  }

  let bounds = resolved.bounds;
  if (bounds.preset === "last-import" && bounds.importId) {
    bounds = refineLastImportBounds(
      bounds,
      eventsByImportId.get(bounds.importId) ?? [],
    );
  }

  const primaryImport = imports.at(-1)!;
  const mapping = (primaryImport.field_mapping ?? {}) as FieldMapping;
  const totalRowCount = imports.reduce((sum, record) => sum + record.row_count, 0);
  const hasDurationField = imports.some((record) => record.has_duration_field);

  const dashboard = buildTrendsDashboard({
    allEvents,
    eventsByImportId,
    importContexts,
    metadata: {
      headers: primaryImport.headers,
      mapping,
      hasDurationField,
      analyzedRowCount: totalRowCount,
      sourceFileName:
        imports.length === 1
          ? primaryImport.file_name
          : `Accumulated (${imports.length} imports)`,
    },
    config,
    bounds,
  });

  return {
    configured: true,
    defaultPreset,
    validationError: null,
    dashboard,
    dataRange: {
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    },
  };
}

export { parseTrendsPeriodPreset };
