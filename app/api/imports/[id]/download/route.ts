import { NextResponse } from "next/server";
import {
  downloadCsvFromStorage,
  getServerImportById,
} from "@/lib/server/db/inbound-email-repository";
import {
  getSupabaseStorageBucket,
  isSupabaseConfigured,
} from "@/lib/server/env";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const storagePath = record.failed_csv_path ?? record.original_file_path;

    if (!storagePath) {
      return NextResponse.json(
        { error: "No CSV available for this import." },
        { status: 404 },
      );
    }

    const csvText = await downloadCsvFromStorage(
      storagePath,
      getSupabaseStorageBucket(),
    );

    return new NextResponse(csvText, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${record.file_name}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed." },
      { status: 500 },
    );
  }
}
