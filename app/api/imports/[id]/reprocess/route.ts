import { NextResponse } from "next/server";
import { reprocessImport } from "@/lib/server/imports/import-service";
import { isSupabaseConfigured } from "@/lib/server/env";
import { sourceToLabel } from "@/lib/server/types/import-management";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Import ID is required." }, { status: 400 });
  }

  try {
    const record = await reprocessImport(id);

    return NextResponse.json({
      import: {
        id: record.id,
        sourceLabel: sourceToLabel(record.source),
        fileName: record.file_name,
        status: record.status,
        doorCount: record.door_count,
        incidentCount: record.incident_count,
        complianceScoreSnapshot: record.compliance_score_snapshot,
        processingDurationMs: record.processing_duration_ms,
        processingResult: record.processing_result,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reprocess failed.";

    if (message === "Import not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
