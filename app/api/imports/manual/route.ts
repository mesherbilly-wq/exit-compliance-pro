import { NextResponse } from "next/server";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import { createManualCsvImport } from "@/lib/server/imports/import-service";
import { isSupabaseConfigured } from "@/lib/server/env";
import { looksLikeCsvContent } from "@/lib/server/inbound-email/attachment-validation";

export const runtime = "nodejs";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only .csv files are supported." },
        { status: 400 },
      );
    }

    const maxBytes = Number(
      process.env.INBOUND_MAX_ATTACHMENT_BYTES ?? DEFAULT_MAX_BYTES,
    );

    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "CSV file exceeds the maximum allowed size." },
        { status: 400 },
      );
    }

    const csvText = await file.text();

    if (!looksLikeCsvContent(csvText)) {
      return NextResponse.json(
        { error: "File does not contain valid CSV content." },
        { status: 400 },
      );
    }

    const record = await createManualCsvImport({
      fileName: file.name,
      csvText,
      config: DEFAULT_ANALYTICS_CONFIG,
    });

    return NextResponse.json({
      import: {
        id: record.id,
        fileName: record.file_name,
        rowCount: record.row_count,
        columnCount: record.column_count,
        headers: record.headers,
        status: record.status,
        uploadedAt: record.created_at,
        source: record.source,
        analysisSnapshot: record.analysis_snapshot,
        processingResult: record.processing_result,
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "imports-api",
        event: "manual-upload-error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Manual upload failed.",
      },
      { status: 500 },
    );
  }
}
