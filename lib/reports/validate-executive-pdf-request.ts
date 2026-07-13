import type { TrendsPeriodPreset } from "@/lib/analytics/trends-period";

export type ExecutivePdfRequestBody = {
  heldOpenThresholdSeconds?: number;
  period?: TrendsPeriodPreset;
  customStart?: string;
  customEnd?: string;
};

export type ExecutivePdfValidationResult =
  | { valid: true; body: ExecutivePdfRequestBody }
  | { valid: false; error: string };

const VALID_PERIODS = new Set<TrendsPeriodPreset>([
  "last-import",
  "last-24-hours",
  "last-7-days",
  "last-30-days",
  "all-time",
  "custom",
]);

export function parseExecutivePdfRequestBody(
  payload: unknown,
): ExecutivePdfValidationResult {
  if (payload === null || payload === undefined) {
    return { valid: true, body: {} };
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const body = payload as Record<string, unknown>;
  const result: ExecutivePdfRequestBody = {};

  if ("heldOpenThresholdSeconds" in body) {
    const threshold = Number(body.heldOpenThresholdSeconds);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return {
        valid: false,
        error: "heldOpenThresholdSeconds must be a positive number.",
      };
    }

    result.heldOpenThresholdSeconds = threshold;
  }

  if ("period" in body) {
    if (typeof body.period !== "string" || !VALID_PERIODS.has(body.period as TrendsPeriodPreset)) {
      return { valid: false, error: "Invalid reporting period value." };
    }

    result.period = body.period as TrendsPeriodPreset;
  }

  if ("customStart" in body) {
    if (typeof body.customStart !== "string") {
      return { valid: false, error: "customStart must be a string date." };
    }

    result.customStart = body.customStart;
  }

  if ("customEnd" in body) {
    if (typeof body.customEnd !== "string") {
      return { valid: false, error: "customEnd must be a string date." };
    }

    result.customEnd = body.customEnd;
  }

  if (result.period === "custom" && (!result.customStart || !result.customEnd)) {
    return {
      valid: false,
      error: "Custom reporting periods require customStart and customEnd.",
    };
  }

  return { valid: true, body: result };
}

export function parseExecutivePdfThreshold(
  request: Request,
  body: ExecutivePdfRequestBody,
): number {
  if (body.heldOpenThresholdSeconds) {
    return body.heldOpenThresholdSeconds;
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("heldOpenThresholdSeconds");
  const threshold = Number(raw);

  if (Number.isFinite(threshold) && threshold > 0) {
    return threshold;
  }

  return 30;
}
