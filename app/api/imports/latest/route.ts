import { NextResponse } from "next/server";
import { getLatestImportForAnalytics } from "@/lib/server/db/latest-import";
import { buildImportAnalysisSnapshotFromImport } from "@/lib/server/imports/build-intelligence-from-db";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ import: null, configured: false });
  }

  try {
    const record = await getLatestImportForAnalytics();
    if (!record) {
      return NextResponse.json({ import: null, configured: true });
    }

    const analysisSnapshot = await buildImportAnalysisSnapshotFromImport(record);

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
        doorCount: record.door_count,
        incidentCount: record.incident_count,
        complianceScoreSnapshot: record.compliance_score_snapshot,
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
