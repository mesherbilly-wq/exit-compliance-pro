import { NextResponse } from "next/server";
import { getLatestImportForAnalytics } from "@/lib/server/db/latest-import";
import { buildImportAnalysisSnapshotFromImport } from "@/lib/server/imports/build-intelligence-from-db";
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

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ import: null, configured: false });
  }

  try {
    const record = await getLatestImportForAnalytics();
    if (!record) {
      return NextResponse.json({ import: null, configured: true });
    }

    const config = {
      heldOpenThresholdSeconds: parseThreshold(request),
    };

    const analysisSnapshot = await buildImportAnalysisSnapshotFromImport(
      record,
      config,
    );

    if (!analysisSnapshot) {
      return NextResponse.json({ import: null, configured: true });
    }

    return NextResponse.json({
      configured: true,
      import: {
        id: record.id,
        fileName: record.file_name,
        rowCount: record.row_count,
        columnCount: record.column_count,
        headers: record.headers,
        status: record.status,
        uploadedAt: record.created_at,
        source: record.source,
        sender: record.sender,
        analysisSnapshot,
        reportingPeriodStart: record.reporting_period_start,
        reportingPeriodEnd: record.reporting_period_end,
        processingDurationMs: record.processing_duration_ms,
        doorCount: analysisSnapshot.intelligence.summary.totalDoors,
        incidentCount: analysisSnapshot.intelligence.summary.totalHeldOpenEvents,
        complianceScoreSnapshot:
          analysisSnapshot.intelligence.summary.overallComplianceScore,
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
