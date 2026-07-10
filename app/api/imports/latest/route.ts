import { NextResponse } from "next/server";
import { getLatestImportForAnalytics } from "@/lib/server/db/latest-import";
import { isSupabaseConfigured } from "@/lib/server/env";
import type { ImportAnalysisSnapshot } from "@/lib/imports/types";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ import: null, configured: false });
  }

  try {
    const record = await getLatestImportForAnalytics();
    if (!record?.analysis_snapshot) {
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
        analysisSnapshot: record.analysis_snapshot as ImportAnalysisSnapshot,
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
