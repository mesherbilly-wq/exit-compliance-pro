import { getAnalyticsConfig } from "@/lib/analytics/config";
import { buildAnalyticsConfigQueryString } from "@/lib/analytics/parse-analytics-config";
import type { TrendsDashboard } from "@/lib/analytics/trends-dashboard";
import type { TrendsPeriodPreset } from "@/lib/analytics/trends-period";

export type TrendsApiPayload = {
  configured: boolean;
  defaultPreset: TrendsPeriodPreset | null;
  validationError: string | null;
  dashboard: TrendsDashboard | null;
  dataRange: {
    start: string | null;
    end: string | null;
  };
};

export async function fetchTrendsDashboard(input: {
  period?: TrendsPeriodPreset;
  customStart?: string;
  customEnd?: string;
}): Promise<TrendsApiPayload> {
  const config = getAnalyticsConfig();
  const params = new URLSearchParams(buildAnalyticsConfigQueryString(config));

  if (input.period) {
    params.set("period", input.period);
  }

  if (input.period === "custom") {
    if (input.customStart) {
      params.set("customStart", input.customStart);
    }

    if (input.customEnd) {
      params.set("customEnd", input.customEnd);
    }
  }

  const response = await fetch(`/api/trends?${params.toString()}`);

  if (!response.ok) {
    const payload = (await response.json()) as TrendsApiPayload;
    throw new Error(payload.validationError ?? "Failed to load trends dashboard.");
  }

  return (await response.json()) as TrendsApiPayload;
}
