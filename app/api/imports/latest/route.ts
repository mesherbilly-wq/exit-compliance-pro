import { NextResponse } from "next/server";
import { buildAccumulatedImportAnalysisSnapshot } from "@/lib/server/imports/build-intelligence-from-db";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

function parseThreshold(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("heldOpenThresholdSeconds");
  const threshold = Number(raw);

  if (Number.isFinite(threshold) && threshold > 0) {
    return threshold;
  }

  return DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds;
}

function formatReportingPeriod(
  start: string | null,
  end: string | null,
): { start: string | null; end: string | null } {
  return { start, end };
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ import: null, configured: false });
  }

  try {
    const config = {
      heldOpenThresholdSeconds: parseThreshold(request),
    };

    const accumulated = await buildAccumulatedImportAnalysisSnapshot(config);

    if (!accumulated) {
      return NextResponse.json({ import: null, configured: true });
    }

    const { imports, primaryImport, snapshot } = accumulated;
    const timestamps = (snapshot.parsedEvents ?? [])
      .map((event) => event.timestamp)
      .filter((value) => Number.isFinite(value));

    const reportingPeriodStart =
      timestamps.length > 0
        ? new Date(Math.min(...timestamps)).toISOString()
        : primaryImport.reporting_period_start;
    const reportingPeriodEnd =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : primaryImport.reporting_period_end;

    const { start, end } = formatReportingPeriod(
      reportingPeriodStart,
      reportingPeriodEnd,
    );

    return NextResponse.json({
      configured: true,
      importCount: imports.length,
      import: {
        id: primaryImport.id,
        fileName:
          imports.length === 1
            ? primaryImport.file_name
            : `Accumulated (${imports.length} imports)`,
        rowCount: snapshot.analyzedRowCount,
        columnCount: primaryImport.column_count,
        headers: primaryImport.headers,
        status: primaryImport.status,
        uploadedAt: primaryImport.created_at,
        source: primaryImport.source,
        sender: primaryImport.sender,
        analysisSnapshot: snapshot,
        reportingPeriodStart: start,
        reportingPeriodEnd: end,
        processingDurationMs: primaryImport.processing_duration_ms,
        doorCount: snapshot.intelligence.summary.totalDoors,
        incidentCount: snapshot.intelligence.summary.totalHeldOpenEvents,
        complianceScoreSnapshot:
          snapshot.intelligence.summary.overallComplianceScore,
        accumulatedImportIds: imports.map((record) => record.id),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        import: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
