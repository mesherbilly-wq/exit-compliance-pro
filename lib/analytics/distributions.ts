import type {
  DistributionBucket,
  HeldOpenSession,
  TrendPoint,
} from "./types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekKey(timestamp: number): string {
  const date = new Date(timestamp);
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildTimeOfDayDistribution(
  sessions: HeldOpenSession[],
): DistributionBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    count: 0,
    exposureSeconds: 0,
  }));

  for (const session of sessions) {
    const hour = new Date(session.startTimestamp).getHours();
    buckets[hour].count += 1;
    buckets[hour].exposureSeconds += session.exposureSeconds;
  }

  return buckets;
}

export function buildDayOfWeekDistribution(
  sessions: HeldOpenSession[],
): DistributionBucket[] {
  const buckets = DAY_LABELS.map((label) => ({
    label,
    count: 0,
    exposureSeconds: 0,
  }));

  for (const session of sessions) {
    const day = new Date(session.startTimestamp).getDay();
    buckets[day].count += 1;
    buckets[day].exposureSeconds += session.exposureSeconds;
  }

  return buckets;
}

export function buildWeeklyTrend(sessions: HeldOpenSession[]): TrendPoint[] {
  const grouped = new Map<string, TrendPoint>();

  for (const session of sessions) {
    const periodKey = weekKey(session.startTimestamp);
    const existing = grouped.get(periodKey) ?? {
      periodKey,
      label: periodKey,
      heldOpenEvents: 0,
      exposureSeconds: 0,
    };

    existing.heldOpenEvents += 1;
    existing.exposureSeconds += session.exposureSeconds;
    grouped.set(periodKey, existing);
  }

  return [...grouped.values()].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey),
  );
}

export function buildMonthlyTrend(sessions: HeldOpenSession[]): TrendPoint[] {
  const grouped = new Map<string, TrendPoint>();

  for (const session of sessions) {
    const periodKey = monthKey(session.startTimestamp);
    const existing = grouped.get(periodKey) ?? {
      periodKey,
      label: periodKey,
      heldOpenEvents: 0,
      exposureSeconds: 0,
    };

    existing.heldOpenEvents += 1;
    existing.exposureSeconds += session.exposureSeconds;
    grouped.set(periodKey, existing);
  }

  return [...grouped.values()].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey),
  );
}

export function countDaysAffected(sessions: HeldOpenSession[]): number {
  const days = new Set(sessions.map((session) => dateKey(session.startTimestamp)));
  return days.size;
}

export function countRepeatOccurrences(sessions: HeldOpenSession[]): number {
  if (sessions.length <= 1) {
    return 0;
  }

  const byDay = new Map<string, number>();
  for (const session of sessions) {
    const key = dateKey(session.startTimestamp);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  let repeats = 0;
  for (const count of byDay.values()) {
    if (count > 1) {
      repeats += count - 1;
    }
  }

  return Math.max(repeats, sessions.length - 1);
}

export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
