import { NextResponse } from "next/server";
import { DEFAULT_ANALYTICS_CONFIG } from "@/lib/analytics/config";
import {
  buildAttentionCentreApiResponse,
  parseAttentionCentreFiltersFromSearchParams,
} from "@/lib/server/attention-centre/build-attention-response";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

function parseThreshold(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("heldOpenThresholdSeconds");
  const threshold = Number(raw);

  if (Number.isFinite(threshold) && threshold > 0) {
    return threshold;
  }

  return DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds;
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, dashboard: null });
  }

  try {
    const url = new URL(request.url);
    const filters = parseAttentionCentreFiltersFromSearchParams(url.searchParams);

    const response = await buildAttentionCentreApiResponse({
      config: {
        heldOpenThresholdSeconds: parseThreshold(request),
      },
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
