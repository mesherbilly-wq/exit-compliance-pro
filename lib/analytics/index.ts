export {
  buildComplianceIntelligenceDashboard,
} from "./compliance-intelligence";
export type {
  ComplianceIntelligenceDashboard,
  ComplianceRecommendation,
} from "./compliance-intelligence";
export {
  buildDoorIntelligenceRows,
  getRiskRating,
  getTrendDirection,
  getTopHighestRiskDoors,
  getTopImprovingDoors,
  getTopDeterioratingDoors,
  sortDoorIntelligenceRows,
} from "./door-intelligence-view";
export type {
  DoorIntelligenceRow,
  DoorIntelligenceSortKey,
  RiskRating,
  TrendDirection,
} from "./door-intelligence-view";
export {
  runFireExitIntelligenceEngine,
  canRunFireExitIntelligence,
} from "./fire-exit-intelligence-engine";
export {
  getAnalyticsConfig,
  saveAnalyticsConfig,
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_HELD_OPEN_THRESHOLD_SECONDS,
} from "./config";
export type {
  FireExitIntelligenceReport,
  FireExitAnalyticsConfig,
  DoorIntelligenceProfile,
  FireExitPortfolioSummary,
  DistributionBucket,
  TrendPoint,
  HeldOpenSession,
} from "./types";
export {
  toDoorHealthAnalysis,
  toFireExitDashboardAnalysis,
  toExitComplianceAnalysis,
} from "./report-adapters";
