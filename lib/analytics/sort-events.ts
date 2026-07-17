import type { ParsedFireExitEvent } from "./types";

/**
 * Deterministic ordering for door events.
 *
 * 1. event timestamp ascending
 * 2. source CSV sequence (sourceSequence, then sourceRowNumber)
 * 3. stable fallback: sourceEventId, then eventType + eventTime
 *
 * Same-timestamp open/close ordering follows CSV row order — not a blanket
 * "opens before closes" rule — so Genetec bounce sequences pair correctly.
 */
export function compareEventsDeterministic(
  a: ParsedFireExitEvent,
  b: ParsedFireExitEvent,
): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }

  const seqA = a.sourceSequence ?? a.sourceRowNumber ?? Number.MAX_SAFE_INTEGER;
  const seqB = b.sourceSequence ?? b.sourceRowNumber ?? Number.MAX_SAFE_INTEGER;

  if (seqA !== seqB) {
    return seqA - seqB;
  }

  const idA = a.sourceEventId ?? `${a.eventType}|${a.eventTime}`;
  const idB = b.sourceEventId ?? `${b.eventType}|${b.eventTime}`;

  return idA.localeCompare(idB);
}

export function sortEventsDeterministic(
  events: ParsedFireExitEvent[],
): ParsedFireExitEvent[] {
  return [...events].sort(compareEventsDeterministic);
}
