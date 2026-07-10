import { NextResponse } from "next/server";
import { deleteServerImport } from "@/lib/server/db/inbound-email-repository";
import {
  getSupabaseStorageBucket,
  isSupabaseConfigured,
} from "@/lib/server/env";

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

    console.error(
      JSON.stringify({
        scope: "imports-api",
        event: "delete-error",
        importId: id,
        message,
      }),
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
