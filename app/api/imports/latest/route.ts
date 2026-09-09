import { NextResponse } from "next/server";
import { buildAccumulatedImportAnalysisSnapshot } from "@/lib/server/imports/build-intelligence-from-db";
import { reportingPeriodFromImports } from "@/lib/server/imports/import-analysis-snapshot";
import { parseAnalyticsConfigFromRequest } from "@/lib/analytics/parse-analytics-config";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ import: null, configured: false });
  }

  try {
    const config = parseAnalyticsConfigFromRequest(request);
    const accumulated = await buildAccumulatedImportAnalysisSnapshot(config);

    if (!accumulated) {
      return NextResponse.json({ import: null, configured: true });
    }

    const { imports, primaryImport, snapshot } = accumulated;
    const { start, end } = reportingPeriodFromImports(imports);

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
        importDataRetentionDays: config.importDataRetentionDays,
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
