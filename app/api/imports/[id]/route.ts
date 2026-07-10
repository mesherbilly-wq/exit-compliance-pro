import { NextResponse } from "next/server";
import {
  saveImportAnalysisSnapshot,
  updateImportMapping,
} from "@/lib/server/imports/import-service";
import { deleteServerImport } from "@/lib/server/db/inbound-email-repository";
import {
  getSupabaseStorageBucket,
  isSupabaseConfigured,
} from "@/lib/server/env";
import type { FieldMapping, ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { ServerImportStatus } from "@/lib/server/types/inbound-email";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
      return NextResponse.json({ import: record });
    }

    if (body.analysisSnapshot) {
      const record = await saveImportAnalysisSnapshot(
        id,
        body.analysisSnapshot,
        body.status,
      );
      return NextResponse.json({ import: record });
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
