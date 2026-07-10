import { NextResponse } from "next/server";
import { getServerImportById } from "@/lib/server/db/inbound-email-repository";
import { isSupabaseConfigured } from "@/lib/server/env";

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

    return NextResponse.json({
      importId: record.id,
      processingLog: record.processing_log ?? [],
      errorCount: record.error_count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load log." },
      { status: 500 },
    );
  }
}
