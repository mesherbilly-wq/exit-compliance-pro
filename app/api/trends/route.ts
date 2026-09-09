import { NextResponse } from "next/server";
import {
  buildTrendsApiResponse,
  parseTrendsPeriodPreset,
} from "@/lib/server/trends/build-trends-response";
import { parseAnalyticsConfigFromRequest } from "@/lib/analytics/parse-analytics-config";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      defaultPreset: null,
      validationError: null,
      dashboard: null,
      dataRange: { start: null, end: null },
    });
  }

  try {
    const url = new URL(request.url);
    const preset = parseTrendsPeriodPreset(url.searchParams.get("period"));
    const hasExplicitPeriod = url.searchParams.has("period");
    const customStart = url.searchParams.get("customStart");
    const customEnd = url.searchParams.get("customEnd");
    const config = parseAnalyticsConfigFromRequest(request);

    const response = await buildTrendsApiResponse({
      preset: hasExplicitPeriod ? preset : undefined,
      customStart,
      customEnd,
      config,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load trends dashboard.";

    return NextResponse.json(
      {
        configured: true,
        defaultPreset: null,
        validationError: message,
        dashboard: null,
        dataRange: { start: null, end: null },
      },
      { status: 500 },
    );
  }
}
