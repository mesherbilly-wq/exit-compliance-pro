import { NextResponse } from "next/server";
import {
  buildAttentionCentreApiResponse,
  parseAttentionCentreFiltersFromSearchParams,
} from "@/lib/server/attention-centre/build-attention-response";
import { parseAnalyticsConfigFromRequest } from "@/lib/analytics/parse-analytics-config";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, dashboard: null });
  }

  try {
    const url = new URL(request.url);
    const filters = parseAttentionCentreFiltersFromSearchParams(url.searchParams);
    const config = parseAnalyticsConfigFromRequest(request);

    const response = await buildAttentionCentreApiResponse({
      config,
      filters,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Attention Centre load failed:", error);

    return NextResponse.json(
      {
        configured: true,
        dashboard: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Attention Centre.",
      },
      { status: 500 },
    );
  }
}
