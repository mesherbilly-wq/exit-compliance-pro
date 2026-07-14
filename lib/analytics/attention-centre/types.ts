import type { ComplianceIncident, RiskRating } from "@/lib/analytics/types";

export type AttentionSourceSystem =
  | "genetec"
  | "ajax"
  | "paxton"
  | "gallagher"
  | "unknown";

/**
 * Normalised incident consumed by Attention Centre analytics.
 * Future integrations should map vendor events into this shape only.
 */
export type NormalizedAttentionIncident = ComplianceIncident & {
  building: string;
  sourceSystem: AttentionSourceSystem;
};

export type AttentionCentreConfig = {
  heldOpenThresholdSeconds: number;
  criticalComplianceScoreThreshold: number;
  criticalHeldOpenMinutes: number;
  repeatIncidentsTodayThreshold: number;
  incidentFreeDaysThreshold: number;
};

export const DEFAULT_ATTENTION_CENTRE_CONFIG: Omit<
  AttentionCentreConfig,
  "heldOpenThresholdSeconds"
> = {
  criticalComplianceScoreThreshold: 50,
  criticalHeldOpenMinutes: 30,
  repeatIncidentsTodayThreshold: 3,
  incidentFreeDaysThreshold: 30,
};

export type AttentionCriticalItem = {
  id: string;
  door: string;
  building: string;
  issue: string;
  currentRisk: RiskRating;
  durationLabel: string;
  actionLabel: string;
  actionHref: string;
  sourceSystem: AttentionSourceSystem;
};

export type AttentionInvestigationItem = {
  id: string;
  door: string;
  building: string;
  pattern: string;
  evidence: string;
  suggestedInvestigation: string;
  investigateHref: string;
  sourceSystem: AttentionSourceSystem;
};

export type AttentionImprovementItem = {
  id: string;
  door: string;
  building: string;
  improvement: string;
  impact: string;
  sourceSystem: AttentionSourceSystem;
};

export type AttentionRecommendationTier = "critical" | "high" | "medium" | "low";

export type AttentionRecommendationCard = {
  id: string;
  tier: AttentionRecommendationTier;
  door: string | null;
  building: string;
  title: string;
  whyThisMatters: string;
  recommendedAction: string;
  expectedBenefit: string;
  sourceSystem: AttentionSourceSystem;
};

export type AttentionRecommendationGroups = Record<
  AttentionRecommendationTier,
  AttentionRecommendationCard[]
>;

export type AttentionCentreFilterOptions = {
  risks: RiskRating[];
  doors: string[];
  buildings: string[];
  dateRange: { min: string; max: string };
};

export type AttentionCentreFilters = {
  risk: RiskRating | "All";
  door: string;
  building: string;
  dateFrom: string;
  dateTo: string;
};

export type AttentionCentreDashboard = {
  generatedAt: string;
  sourceFileName: string;
  hasProcessedImports: boolean;
  filterOptions: AttentionCentreFilterOptions;
  filters: AttentionCentreFilters;
  critical: AttentionCriticalItem[];
  needsInvestigation: AttentionInvestigationItem[];
  improvements: AttentionImprovementItem[];
  recommendations: AttentionRecommendationGroups;
  summary: {
    criticalCount: number;
    investigationCount: number;
    improvementCount: number;
    recommendationCount: number;
  };
};

export type AttentionCentreBuildInput = {
  report: import("@/lib/analytics/types").FireExitIntelligenceReport;
  normalizedIncidents: NormalizedAttentionIncident[];
  doorBuildingMap: Map<string, string>;
  config: AttentionCentreConfig;
  improvingDoors: Array<{
    door: string;
    differencePoints: number | null;
    trend: string;
  }>;
  decliningDoors: Array<{
    door: string;
    differencePoints: number | null;
    trend: string;
  }>;
  comparisonAvailable: boolean;
  referenceMs?: number;
};
