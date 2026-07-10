import { NextResponse } from "next/server";
import {
  saveImportAnalysisSnapshot,
  updateImportMapping,
} from "@/lib/server/imports/import-service";
import { deleteServerImport, getServerImportById } from "@/lib/server/db/inbound-email-repository";
import { buildImportAnalysisSnapshotFromImport } from "@/lib/server/imports/build-intelligence-from-db";
import {
  getSupabaseStorageBucket,
  isSupabaseConfigured,
} from "@/lib/server/env";
import type { FieldMapping, ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { ServerImportStatus } from "@/lib/server/types/inbound-email";
import { sourceToLabel } from "@/lib/server/types/import-management";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function mapImportResponse(record: NonNullable<Awaited<ReturnType<typeof getServerImportById>>>) {
  return {
    id: record.id,
    source: record.source,
    sourceLabel: sourceToLabel(record.source),
    fileName: record.file_name,
    sender: record.sender ?? record.inbound_emails?.from_address ?? null,
    emailSubject: record.inbound_emails?.subject ?? null,
    status: record.status,
    rowCount: record.row_count,
    columnCount: record.column_count,
    headers: record.headers,
    uploadedAt: record.created_at,
    importedDate: record.created_at,
    reportingPeriodStart: record.reporting_period_start,
    reportingPeriodEnd: record.reporting_period_end,
    processingDurationMs: record.processing_duration_ms,
    doorCount: record.door_count,
    incidentCount: record.incident_count,
    complianceScoreSnapshot: record.compliance_score_snapshot,
    processingLog: record.processing_log ?? [],
    errorCount: record.error_count ?? 0,
    hasAnalytics: record.has_analytics ?? false,
    failedCsvAvailable: Boolean(record.failed_csv_path),
    processingResult: record.processing_result,
  };
}

export async function GET(_request: Request, context: RouteContext) {
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
    const record = await getServerImportById(id);

    if (!record) {
      return NextResponse.json({ error: "Import not found." }, { status: 404 });
    }

    const analysisSnapshot = await buildImportAnalysisSnapshotFromImport(record);

    return NextResponse.json({
      import: {
        ...mapImportResponse(record),
        analysisSnapshot: analysisSnapshot ?? undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load import." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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
    await deleteServerImport(id, getSupabaseStorageBucket());
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";

    if (message === "Import not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
    const body = (await request.json()) as {
      mapping?: FieldMapping;
      analysisSnapshot?: ImportAnalysisSnapshot;
      status?: ServerImportStatus;
    };

    if (body.mapping) {
      const record = await updateImportMapping(id, body.mapping);
      return NextResponse.json({ import: mapImportResponse(record) });
    }

    if (body.analysisSnapshot) {
      const record = await saveImportAnalysisSnapshot(
        id,
        body.analysisSnapshot,
        body.status,
      );
      return NextResponse.json({ import: mapImportResponse(record) });
    }

    return NextResponse.json({ error: "No update payload provided." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Update failed.",
      },
      { status: 500 },
    );
  }
}
