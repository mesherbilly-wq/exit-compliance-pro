import { NextResponse } from "next/server";
import { refreshAllImportAnalysisSnapshots } from "@/lib/server/imports/import-service";
import { parseAnalyticsConfigFromBody } from "@/lib/analytics/parse-analytics-config";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const config = parseAnalyticsConfigFromBody(body);
    const result = await refreshAllImportAnalysisSnapshots(config);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Refresh analysis failed.",
      },
      { status: 500 },
    );
  }
}
