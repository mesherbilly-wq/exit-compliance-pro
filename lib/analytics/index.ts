export {
  buildComplianceIntelligenceDashboard,
} from "./compliance-intelligence";
export {
  generateComplianceRecommendations,
  formatRecommendationMessage,
  getDoorRecommendations,
} from "./compliance-recommendations";
export { loadDoorProfile } from "./door-profile-loader";
export type { DoorProfileData } from "./door-profile-loader";
export type {
  ComplianceIntelligenceDashboard,
} from "./compliance-intelligence";
export type {
  ComplianceRecommendation,
  RecommendationCategory,
  RecommendationPriority,
  RecommendationSignal,
  ComplianceRecommendationEvidence,
  TimePatternEvidence,
  WeeklyPatternEvidence,
  RepeatBehaviourEvidence,
  ComplianceTrendEvidence,
  IncidentDurationEvidence,
  DoorRiskEvidence,
  IncidentFreeEvidence,
  PortfolioEvidence,
} from "./compliance-recommendations";
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
  TrendDirection,
} from "./door-intelligence-view";
export {
  calculateExposureComplianceScore,
  buildDoorIntelligenceProfile,
} from "./scoring";
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
export {
  buildComplianceIncidents,
  getIncidentDurationBucket,
  getIncidentRiskRating,
} from "./compliance-incidents";
export {
  buildDoorComplianceProfile,
  ensureDoorComplianceProfile,
  getDoorComplianceProfiles,
  attachComplianceProfilesToReport,
  getIncidentFrequency,
  getOperationalPattern,
  getPeakRiskWindow,
  getRiskTrend,
  toDoorIntelligenceProfile,
} from "./door-compliance-profile";
export type {
  FireExitIntelligenceReport,
  FireExitAnalyticsConfig,
  DoorIntelligenceProfile,
  DoorComplianceProfile,
  FireExitPortfolioSummary,
  DistributionBucket,
  TrendPoint,
  ComplianceIncident,
  IncidentDurationBucket,
  HeldOpenSession,
  RiskRating,
  ComplianceRating,
  RiskTrend,
  IncidentFrequency,
  OperationalPattern,
} from "./types";
export { toHeldOpenSession } from "./types";
export {
  toDoorHealthAnalysis,
  toFireExitDashboardAnalysis,
  toExitComplianceAnalysis,
} from "./report-adapters";
