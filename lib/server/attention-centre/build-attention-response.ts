import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import {
  applyAttentionCentreFilters,
  buildAttentionCentre,
  getDefaultAttentionFilters,
} from "@/lib/analytics/attention-centre/build-attention-centre";
import {
  collectNormalizedIncidentsFromDoors,
  detectAttentionSourceSystem,
} from "@/lib/analytics/attention-centre/normalize-incidents";
import type {
  AttentionCentreConfig,
  AttentionCentreDashboard,
  AttentionCentreFilters,
} from "@/lib/analytics/attention-centre/types";
import { buildTrendsDashboard } from "@/lib/analytics/trends-dashboard";
import {
  getEventTimestampBounds,
  refineLastImportBounds,
  resolveTrendsPeriodBounds,
} from "@/lib/analytics/trends-period";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";
import { getDoorIncidents } from "@/lib/analytics/normalize-intelligence";
import { loadParsedEventsGroupedByImports } from "@/lib/server/db/import-analytics-repository";
import {
  getEventLoadOptionsForRetention,
  listImportsForAnalytics,
} from "@/lib/server/db/latest-import";
import { buildAccumulatedImportAnalysisSnapshot } from "@/lib/server/imports/build-intelligence-from-db";
import type { RiskRating } from "@/lib/analytics/types";

export type AttentionCentreApiResponse = {
  configured: boolean;
  dashboard: AttentionCentreDashboard | null;
};

function parseRisk(value: string | null): RiskRating | "All" {
  switch (value) {
    case "Critical":
    case "High":
    case "Medium":
    case "Low":
      return value;
    default:
      return "All";
  }
}

function buildAttentionConfig(
  config: FireExitAnalyticsConfig,
): AttentionCentreConfig {
  return {
    heldOpenThresholdSeconds: config.heldOpenThresholdSeconds,
    ...({
      criticalComplianceScoreThreshold: 50,
      criticalHeldOpenMinutes: 30,
      repeatIncidentsTodayThreshold: 3,
      incidentFreeDaysThreshold: 30,
    } satisfies Omit<AttentionCentreConfig, "heldOpenThresholdSeconds">),
  };
}

export async function buildAttentionCentreApiResponse(input: {
  config?: FireExitAnalyticsConfig;
  filters?: Partial<AttentionCentreFilters>;
}): Promise<AttentionCentreApiResponse> {
  const config = input.config ?? DEFAULT_ANALYTICS_CONFIG;
  const accumulated = await buildAccumulatedImportAnalysisSnapshot(config);

  if (!accumulated) {
    return { configured: true, dashboard: null };
  }

  const { snapshot, imports } = accumulated;
  const intelligence = snapshot.intelligence;
  const importIds = imports.map((record) => record.id);
  const { allEvents, eventsByImportId } =
    await loadParsedEventsGroupedByImports(
      importIds,
      getEventLoadOptionsForRetention(config),
    );
  const { startMs, endMs } = getEventTimestampBounds(allEvents);
  const importRefs = imports.map((record) => ({
    id: record.id,
    createdAt: record.created_at,
    fileName: record.file_name,
  }));

  let trendsBounds = resolveTrendsPeriodBounds({
    preset: "last-7-days",
    dataStartMs: startMs,
    dataEndMs: endMs,
    imports: importRefs,
  }).bounds;

  if (trendsBounds?.preset === "last-import" && trendsBounds.importId) {
    trendsBounds = refineLastImportBounds(
      trendsBounds,
      eventsByImportId.get(trendsBounds.importId) ?? [],
    );
  }

  const trendsDashboard =
    trendsBounds &&
    buildTrendsDashboard({
      allEvents,
      eventsByImportId,
      metadata: {
        headers: imports.at(-1)!.headers,
        mapping: intelligence.mapping,
        hasDurationField: intelligence.summary.hasDurationField,
        analyzedRowCount: snapshot.analyzedRowCount,
        sourceFileName: intelligence.sourceFileName,
      },
      config,
      bounds: trendsBounds,
    });

  const sourceSystem = detectAttentionSourceSystem(intelligence.sourceFileName);
  const doorBuildingMap = new Map<string, string>();
  const normalizedIncidents = collectNormalizedIncidentsFromDoors(
    intelligence.doors,
    (door) => getDoorIncidents(door, config.heldOpenThresholdSeconds),
    doorBuildingMap,
    sourceSystem,
  );

  const baseDashboard = buildAttentionCentre({
    report: intelligence,
    normalizedIncidents,
    doorBuildingMap,
    config: buildAttentionConfig(config),
    improvingDoors: trendsDashboard?.topImprovingDoors ?? [],
    decliningDoors: trendsDashboard?.topDecliningDoors ?? [],
    comparisonAvailable: trendsDashboard?.improvingComparisonAvailable ?? false,
  });

  const defaultFilters = getDefaultAttentionFilters(baseDashboard.filterOptions);
  const filters: AttentionCentreFilters = {
    ...defaultFilters,
    ...input.filters,
    risk: input.filters?.risk ?? defaultFilters.risk,
    door: input.filters?.door ?? defaultFilters.door,
    building: input.filters?.building ?? defaultFilters.building,
  };

  return {
    configured: true,
    dashboard: applyAttentionCentreFilters(
      { ...baseDashboard, filters: defaultFilters },
      filters,
    ),
  };
}

export function parseAttentionCentreFiltersFromSearchParams(
  params: URLSearchParams,
): Partial<AttentionCentreFilters> {
  return {
    risk: parseRisk(params.get("risk")),
    door: params.get("door") ?? "All",
    building: params.get("building") ?? "All",
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
  };
}
