import { NextResponse } from "next/server";
import { listServerImports } from "@/lib/server/db/inbound-email-repository";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, imports: [] });
  }

  try {
    const imports = await listServerImports();
    return NextResponse.json({ configured: true, imports });
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "imports-api",
        event: "list-error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );

    return NextResponse.json(
      { configured: true, imports: [], error: "Failed to load imports." },
      { status: 500 },
    );
  }
}
