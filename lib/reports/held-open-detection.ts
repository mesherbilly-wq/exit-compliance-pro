const HELD_OPEN_PATTERNS = [
  "held",
  "held open",
  "door held",
  "open too long",
  "propped",
  "ajar",
];

const DURATION_HEADER_PATTERNS = [
  "duration",
  "open duration",
  "hold duration",
  "held duration",
  "time open",
  "seconds",
  "elapsed",
];

export function isHeldOpenEvent(eventType: string, accessResult = ""): boolean {
  const text = `${eventType} ${accessResult}`.toLowerCase();
  return HELD_OPEN_PATTERNS.some((pattern) => text.includes(pattern));
}

export function findDurationColumn(headers: string[]): string | null {
  for (const header of headers) {
    const normalized = header.toLowerCase();
    if (DURATION_HEADER_PATTERNS.some((pattern) => normalized.includes(pattern))) {
      return header;
    }
  }

  return null;
}

export function parseDurationSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const directNumber = Number(trimmed);
  if (!Number.isNaN(directNumber) && directNumber > 0) {
    return directNumber;
  }

  const secondsMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:sec|second|seconds|s)\b/i);
  if (secondsMatch) {
    return Number(secondsMatch[1]);
  }

  const minutesMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|minutes|m)\b/i);
  if (minutesMatch) {
    return Number(minutesMatch[1]) * 60;
  }

  const clockMatch = trimmed.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    const seconds = clockMatch[3] ? Number(clockMatch[3]) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return "—";
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export type DoorComplianceStatus = "Compliant" | "Warning" | "Critical";

export function getDoorComplianceStatus(score: number): DoorComplianceStatus {
  if (score >= 85) return "Compliant";
  if (score >= 60) return "Warning";
  return "Critical";
}

export function calculateDoorComplianceScore(
  heldOpenCount: number,
  totalDoorEvents: number,
): number {
  if (heldOpenCount === 0) {
    return 100;
  }

  const heldOpenRatio = heldOpenCount / Math.max(totalDoorEvents, 1);
  const score = 100 - heldOpenCount * 4 - heldOpenRatio * 35;

  return Math.max(0, Math.round(score));
}
