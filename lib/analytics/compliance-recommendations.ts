import { getRiskRating } from "./door-intelligence-view";
import { getDoorComplianceProfiles } from "./door-compliance-profile";
import { toDoorIntelligenceProfile } from "./door-compliance-profile";
import type {
  ComplianceIncident,
  DoorComplianceProfile,
  FireExitIntelligenceReport,
  OperationalPattern,
  RiskRating,
} from "./types";

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationSignal =
  | "time_patterns"
  | "weekly_patterns"
  | "repeat_behaviour"
  | "compliance_trend"
  | "incident_duration"
  | "door_risk";

export type RecommendationCategory =
  | "time_pattern"
  | "weekly_pattern"
  | "repeat_behaviour"
  | "compliance_trend"
  | "incident_duration"
  | "door_risk"
  | "incident_free"
  | "portfolio";

export type TimePatternEvidence = {
  timeWindow: string;
  incidentCount: number;
  shareOfIncidents: number;
  operationalPattern?: OperationalPattern;
};

export type WeeklyPatternEvidence = {
  peakDay: string;
  incidentCount: number;
  shareOfIncidents: number;
};

export type RepeatBehaviourEvidence = {
  repeatOccurrences: number;
  daysAffected: number;
  timeWindow?: string;
  incidentCount: number;
};

export type ComplianceTrendEvidence = {
  direction: "Improving" | "Worsening" | "Stable" | "N/A";
  changePercent: number | null;
  comparisonLabel: string;
  riskTrendScore: number;
};

export type IncidentDurationEvidence = {
  longestIncidentLabel: string;
  averageIncidentLabel: string;
  averageBeyondThresholdLabel: string;
  longestBeyondThresholdSeconds: number;
};

export type DoorRiskEvidence = {
  riskRating: RiskRating;
  complianceScore: number;
  complianceRating: DoorComplianceProfile["complianceRating"];
  timeBeyondThresholdLabel: string;
  incidentCount: number;
};

export type IncidentFreeEvidence = {
  daysSinceLastIncident: number;
  lastIncidentLabel: string;
};

export type PortfolioEvidence = {
  peakTime?: string;
  peakDay?: string;
  doorCount?: number;
};

export type ComplianceRecommendationEvidence =
  | TimePatternEvidence
  | WeeklyPatternEvidence
  | RepeatBehaviourEvidence
  | ComplianceTrendEvidence
  | IncidentDurationEvidence
  | DoorRiskEvidence
  | IncidentFreeEvidence
  | PortfolioEvidence;

export type ComplianceRecommendation = {
  id: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  signals: RecommendationSignal[];
  door?: string;
  title: string;
  summary: string;
  action: string;
  message: string;
  evidence: ComplianceRecommendationEvidence;
};

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const DAY_MS = 86_400_000;

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatTimeWindow(startHour: number, endHour: number): string {
  return `${formatHour(startHour)}–${formatHour(endHour)}`;
}

function getReferenceTimestamp(report: FireExitIntelligenceReport): number {
  const parsed = Date.parse(report.analyzedAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function getDaysSince(timestamp: number | null, referenceMs: number): number | null {
  if (timestamp === null) {
    return null;
  }

  return Math.max(0, Math.floor((referenceMs - timestamp) / DAY_MS));
}

function getWeekOverWeekChangePercent(weeklyTrend: DoorComplianceProfile["weeklyTrend"]): number | null {
  if (weeklyTrend.length < 2) {
    return null;
  }

  const last = weeklyTrend[weeklyTrend.length - 1];
  const previous = weeklyTrend[weeklyTrend.length - 2];
  const lastMetric = last.exposureSeconds + last.heldOpenEvents * 10;
  const previousMetric = previous.exposureSeconds + previous.heldOpenEvents * 10;

  if (previousMetric <= 0) {
    return lastMetric > 0 ? 100 : null;
  }

  return Math.round(((lastMetric - previousMetric) / previousMetric) * 100);
}

function findDominantTimeWindow(
  incidents: ComplianceIncident[],
): { startHour: number; endHour: number; count: number } | null {
  if (incidents.length === 0) {
    return null;
  }

  let best: { startHour: number; endHour: number; count: number } | null = null;

  for (let startHour = 0; startHour < 24; startHour += 1) {
    for (const span of [2, 3]) {
      const endHour = Math.min(23, startHour + span - 1);
      const count = incidents.filter(
        (incident) =>
          incident.hourStarted >= startHour && incident.hourStarted <= endHour,
      ).length;

      if (!best || count > best.count) {
        best = { startHour, endHour, count };
      }
    }
  }

  if (!best || best.count === 0) {
    return null;
  }

  return best;
}

function getWeeklyPeakDay(profile: DoorComplianceProfile): WeeklyPatternEvidence | null {
  const total = profile.incidentCount;
  if (total === 0) {
    return null;
  }

  const peak = [...profile.dayOfWeekDistribution]
    .filter((bucket) => bucket.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  if (!peak) {
    return null;
  }

  return {
    peakDay: peak.label,
    incidentCount: peak.count,
    shareOfIncidents: peak.count / total,
  };
}

function buildTimePatternRecommendation(
  profile: DoorComplianceProfile,
): ComplianceRecommendation | null {
  const window = findDominantTimeWindow(profile.incidents);
  if (!window || window.count < 2) {
    return null;
  }

  const share = window.count / Math.max(profile.incidentCount, 1);
  if (share < 0.4 && window.count < 3) {
    return null;
  }

  const timeWindow = formatTimeWindow(window.startHour, window.endHour);
  const evidence: TimePatternEvidence = {
    timeWindow,
    incidentCount: window.count,
    shareOfIncidents: share,
    operationalPattern: profile.operationalPattern,
  };

  const lunchWindow =
    window.startHour >= 11 &&
    window.endHour <= 14 &&
    profile.operationalPattern === "Lunch Time";

  const summary = lunchWindow
    ? `${profile.door} exceeds the held-open threshold mainly at lunchtime (${timeWindow}).`
    : `${profile.door} has repeated incidents between ${timeWindow}.`;

  return {
    id: `${profile.door}-time-pattern`,
    priority: share >= 0.6 || window.count >= 4 ? "high" : "medium",
    category: "time_pattern",
    signals: ["time_patterns", "repeat_behaviour"],
    door: profile.door,
    title: lunchWindow ? "Lunchtime threshold exceedance" : "Repeated time-of-day pattern",
    summary,
    action: lunchWindow
      ? `Review kitchen or service workflows at ${profile.door} during ${timeWindow}.`
      : `Schedule targeted checks at ${profile.door} during ${timeWindow}.`,
    message: summary,
    evidence,
  };
}

function buildWeeklyPatternRecommendation(
  profile: DoorComplianceProfile,
): ComplianceRecommendation | null {
  const peak = getWeeklyPeakDay(profile);
  if (!peak || peak.shareOfIncidents < 0.45 || peak.incidentCount < 2) {
    return null;
  }

  const summary = `${profile.door} incidents cluster on ${peak.peakDay} (${peak.incidentCount} of ${profile.incidentCount} incidents).`;

  return {
    id: `${profile.door}-weekly-pattern`,
    priority: peak.shareOfIncidents >= 0.65 ? "high" : "medium",
    category: "weekly_pattern",
    signals: ["weekly_patterns", "time_patterns"],
    door: profile.door,
    title: "Weekly incident pattern",
    summary,
    action: `Review staffing and delivery routines at ${profile.door} on ${peak.peakDay}.`,
    message: summary,
    evidence: peak,
  };
}

function buildRepeatBehaviourRecommendation(
  profile: DoorComplianceProfile,
): ComplianceRecommendation | null {
  if (profile.repeatOccurrences < 2 && profile.incidentCount < 3) {
    return null;
  }

  const window = findDominantTimeWindow(profile.incidents);
  const timeWindow = window ? formatTimeWindow(window.startHour, window.endHour) : undefined;
  const evidence: RepeatBehaviourEvidence = {
    repeatOccurrences: profile.repeatOccurrences,
    daysAffected: profile.daysAffected,
    timeWindow,
    incidentCount: profile.incidentCount,
  };

  const summary = timeWindow
    ? `${profile.door} shows repeat held-open behaviour, with ${profile.incidentCount} incidents concentrated around ${timeWindow}.`
    : `${profile.door} shows repeat held-open behaviour across ${profile.daysAffected} day${profile.daysAffected === 1 ? "" : "s"}.`;

  return {
    id: `${profile.door}-repeat-behaviour`,
    priority: profile.repeatOccurrences >= 3 ? "high" : "medium",
    category: "repeat_behaviour",
    signals: ["repeat_behaviour", "time_patterns"],
    door: profile.door,
    title: "Repeat operational behaviour",
    summary,
    action: `Investigate why ${profile.door} keeps re-opening during the same operational windows.`,
    message: summary,
    evidence,
  };
}

function buildComplianceTrendRecommendation(
  profile: DoorComplianceProfile,
): ComplianceRecommendation | null {
  const changePercent = getWeekOverWeekChangePercent(profile.weeklyTrend);

  if (profile.riskTrend === "Improving" && changePercent !== null && changePercent <= -15) {
    const improvement = Math.abs(changePercent);
    const evidence: ComplianceTrendEvidence = {
      direction: "Improving",
      changePercent,
      comparisonLabel: "last week",
      riskTrendScore: profile.riskTrendScore,
    };

    const summary = `${profile.door} has improved by ${improvement}% compared to last week.`;

    return {
      id: `${profile.door}-trend-improving`,
      priority: "low",
      category: "compliance_trend",
      signals: ["compliance_trend"],
      door: profile.door,
      title: "Improving compliance trend",
      summary,
      action: `Maintain current controls at ${profile.door} and document what changed.`,
      message: summary,
      evidence,
    };
  }

  if (profile.riskTrend === "Worsening") {
    const evidence: ComplianceTrendEvidence = {
      direction: "Worsening",
      changePercent,
      comparisonLabel: changePercent !== null ? "last week" : "recent weeks",
      riskTrendScore: profile.riskTrendScore,
    };

    const changeLabel =
      changePercent !== null && changePercent > 0
        ? ` (${changePercent}% increase week-on-week)`
        : "";

    const summary = `${profile.door} compliance trend is worsening${changeLabel}.`;

    return {
      id: `${profile.door}-trend-worsening`,
      priority: "high",
      category: "compliance_trend",
      signals: ["compliance_trend", "door_risk"],
      door: profile.door,
      title: "Worsening compliance trend",
      summary,
      action: `Escalate review of ${profile.door} before exposure increases further.`,
      message: summary,
      evidence,
    };
  }

  return null;
}

function buildIncidentDurationRecommendation(
  profile: DoorComplianceProfile,
): ComplianceRecommendation | null {
  if (profile.incidentCount === 0) {
    return null;
  }

  const longestBeyond = Math.max(
    ...profile.incidents.map((incident) => incident.timeBeyondThresholdSeconds),
  );

  if (longestBeyond < 120 && (profile.averageTimeBeyondThresholdSeconds ?? 0) < 60) {
    return null;
  }

  const evidence: IncidentDurationEvidence = {
    longestIncidentLabel: profile.longestIncidentLabel,
    averageIncidentLabel: profile.averageIncidentDurationLabel,
    averageBeyondThresholdLabel: profile.averageTimeBeyondThresholdLabel,
    longestBeyondThresholdSeconds: longestBeyond,
  };

  const summary = `${profile.door} recorded a longest incident of ${profile.longestIncidentLabel} with ${profile.averageTimeBeyondThresholdLabel} average time beyond threshold.`;

  return {
    id: `${profile.door}-incident-duration`,
    priority: longestBeyond >= 600 ? "high" : "medium",
    category: "incident_duration",
    signals: ["incident_duration", "door_risk"],
    door: profile.door,
    title: "Extended held-open duration",
    summary,
    action: `Check door closers, alarms and staff procedures at ${profile.door}.`,
    message: summary,
    evidence,
  };
}

function buildDoorRiskRecommendation(
  profile: DoorComplianceProfile,
): ComplianceRecommendation | null {
  if (profile.incidentCount === 0) {
    return null;
  }

  const riskRating = getRiskRating(toDoorIntelligenceProfile(profile));
  if (riskRating !== "High" && riskRating !== "Critical") {
    return null;
  }

  const evidence: DoorRiskEvidence = {
    riskRating,
    complianceScore: profile.complianceScore,
    complianceRating: profile.complianceRating,
    timeBeyondThresholdLabel: profile.timeBeyondThresholdLabel,
    incidentCount: profile.incidentCount,
  };

  const summary = `${profile.door} is ${riskRating.toLowerCase()} risk with ${profile.timeBeyondThresholdLabel} time beyond threshold and a ${profile.complianceScore}% compliance score.`;

  return {
    id: `${profile.door}-door-risk`,
    priority: riskRating === "Critical" ? "high" : "medium",
    category: "door_risk",
    signals: ["door_risk", "incident_duration"],
    door: profile.door,
    title: `${riskRating} risk fire exit`,
    summary,
    action: `Prioritise remediation at ${profile.door}.`,
    message: summary,
    evidence,
  };
}

function buildIncidentFreeRecommendation(
  profile: DoorComplianceProfile,
  referenceMs: number,
): ComplianceRecommendation | null {
  if (profile.incidentCount > 0) {
    const daysSince = getDaysSince(profile.lastIncidentTimestamp, referenceMs);
    if (daysSince === null || daysSince < 30) {
      return null;
    }

    const evidence: IncidentFreeEvidence = {
      daysSinceLastIncident: daysSince,
      lastIncidentLabel: profile.lastIncidentLabel,
    };

    const summary = `${profile.door} has had no incidents for ${daysSince} day${daysSince === 1 ? "" : "s"}.`;

    return {
      id: `${profile.door}-incident-free`,
      priority: "low",
      category: "incident_free",
      signals: ["compliance_trend"],
      door: profile.door,
      title: "Stable incident-free period",
      summary,
      action: `Continue routine monitoring at ${profile.door}.`,
      message: summary,
      evidence,
    };
  }

  return null;
}

function buildPortfolioRecommendations(
  profiles: DoorComplianceProfile[],
): ComplianceRecommendation[] {
  const recommendations: ComplianceRecommendation[] = [];
  const activeProfiles = profiles.filter((profile) => profile.incidentCount > 0);

  if (activeProfiles.length === 0) {
    recommendations.push({
      id: "portfolio-all-clear",
      priority: "low",
      category: "portfolio",
      signals: ["compliance_trend"],
      title: "Portfolio compliance stable",
      summary: "No held-open compliance incidents were recorded across the analysed fire exits.",
      action: "Continue routine fire exit monitoring.",
      message:
        "No immediate fire exit compliance actions required. Continue routine monitoring.",
      evidence: { doorCount: profiles.length },
    });
    return recommendations;
  }

  const aggregatedHours = Array.from({ length: 24 }, () => 0);
  const aggregatedDays = Array.from({ length: 7 }, () => 0);
  const dayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  for (const profile of activeProfiles) {
    for (const bucket of profile.timeOfDayDistribution) {
      const hour = Number.parseInt(bucket.label.split(":")[0] ?? "0", 10);
      aggregatedHours[hour] += bucket.count;
    }

    for (const bucket of profile.dayOfWeekDistribution) {
      const index = dayIndex[bucket.label];
      if (index !== undefined) {
        aggregatedDays[index] += bucket.count;
      }
    }
  }

  const peakHour = aggregatedHours.indexOf(Math.max(...aggregatedHours));
  const peakDayIndex = aggregatedDays.indexOf(Math.max(...aggregatedDays));
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const peakDay = dayLabels[peakDayIndex] ?? "N/A";
  const peakTime = formatHour(peakHour);

  if (Math.max(...aggregatedHours) > 0) {
    recommendations.push({
      id: "portfolio-peak-time",
      priority: "medium",
      category: "portfolio",
      signals: ["time_patterns"],
      title: "Portfolio peak activity window",
      summary: `Portfolio held-open activity peaks around ${peakTime}.`,
      action: `Increase supervisory checks across fire exits during ${peakTime}.`,
      message: `Increase fire exit checks during the ${peakTime} peak held-open window.`,
      evidence: { peakTime, peakDay, doorCount: profiles.length },
    });
  }

  if (Math.max(...aggregatedDays) > 0) {
    recommendations.push({
      id: "portfolio-peak-day",
      priority: "medium",
      category: "portfolio",
      signals: ["weekly_patterns"],
      title: "Portfolio peak day pattern",
      summary: `${peakDay} is the most common day for held-open incidents portfolio-wide.`,
      action: `Review operational controls on ${peakDay}.`,
      message: `Review operational controls on ${peakDay}, the most common day for held-open incidents.`,
      evidence: { peakDay, peakTime, doorCount: profiles.length },
    });
  }

  return recommendations;
}

function dedupeRecommendations(
  recommendations: ComplianceRecommendation[],
): ComplianceRecommendation[] {
  const seen = new Set<string>();
  const unique: ComplianceRecommendation[] = [];

  for (const recommendation of recommendations) {
    const key = `${recommendation.category}:${recommendation.door ?? "portfolio"}:${recommendation.title}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(recommendation);
  }

  return unique;
}

function sortRecommendations(
  recommendations: ComplianceRecommendation[],
): ComplianceRecommendation[] {
  return [...recommendations].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.title.localeCompare(b.title);
  });
}

export function generateComplianceRecommendations(
  report: FireExitIntelligenceReport,
  limit = 12,
): ComplianceRecommendation[] {
  const profiles = getDoorComplianceProfiles(report);
  const referenceMs = getReferenceTimestamp(report);
  const recommendations: ComplianceRecommendation[] = [];

  for (const profile of profiles) {
    const candidates = [
      buildDoorRiskRecommendation(profile),
      buildTimePatternRecommendation(profile),
      buildRepeatBehaviourRecommendation(profile),
      buildWeeklyPatternRecommendation(profile),
      buildComplianceTrendRecommendation(profile),
      buildIncidentDurationRecommendation(profile),
      buildIncidentFreeRecommendation(profile, referenceMs),
    ].filter((item): item is ComplianceRecommendation => item !== null);

    recommendations.push(...candidates);
  }

  recommendations.push(...buildPortfolioRecommendations(profiles));

  return sortRecommendations(dedupeRecommendations(recommendations)).slice(0, limit);
}

export function formatRecommendationMessage(
  recommendation: ComplianceRecommendation,
): string {
  return recommendation.message || recommendation.summary;
}

export function getDoorRecommendations(
  report: FireExitIntelligenceReport,
  doorName: string,
  limit = 12,
): ComplianceRecommendation[] {
  return generateComplianceRecommendations(report, limit).filter(
    (recommendation) => recommendation.door === doorName,
  );
}
