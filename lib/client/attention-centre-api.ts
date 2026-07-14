import { getAnalyticsConfig } from "@/lib/analytics/config";
import type { AttentionCentreDashboard } from "@/lib/analytics/attention-centre/types";
import type { AttentionCentreFilters } from "@/lib/analytics/attention-centre/types";

export type AttentionCentreApiPayload = {
  configured: boolean;
  dashboard: AttentionCentreDashboard | null;
  error?: string;
};

export async function fetchAttentionCentreDashboard(
  filters: Partial<AttentionCentreFilters> = {},
): Promise<AttentionCentreApiPayload> {
  const config = getAnalyticsConfig();
  const params = new URLSearchParams({
    heldOpenThresholdSeconds: String(config.heldOpenThresholdSeconds),
  });

  if (filters.risk && filters.risk !== "All") {
    params.set("risk", filters.risk);
  }

  if (filters.door && filters.door !== "All") {
    params.set("door", filters.door);
  }

  if (filters.building && filters.building !== "All") {
    params.set("building", filters.building);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  const response = await fetch(`/api/attention-centre?${params.toString()}`);

  if (!response.ok) {
    const payload = (await response.json()) as AttentionCentreApiPayload;
    throw new Error(payload.error ?? "Failed to load Attention Centre.");
  }

  return (await response.json()) as AttentionCentreApiPayload;
}
