import type { ImportAnalysisSnapshot } from "@/lib/imports/types";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export type AccumulatedImportAnalytics = {
  imports: ServerImportRecord[];
  primaryImport: ServerImportRecord;
  snapshot: ImportAnalysisSnapshot;
};

/** Client-facing snapshots omit parsed event rows (loaded server-side only when needed). */
export function toClientImportAnalysisSnapshot(
  snapshot: ImportAnalysisSnapshot,
): ImportAnalysisSnapshot {
  return {
    mapping: snapshot.mapping,
    analyzedRowCount: snapshot.analyzedRowCount,
    intelligence: snapshot.intelligence,
    hasDurationField: snapshot.hasDurationField,
  };
}

export function reportingPeriodFromImports(
  imports: Array<{
    reporting_period_start: string | null;
    reporting_period_end: string | null;
  }>,
): { start: string | null; end: string | null } {
  const starts = imports
    .map((record) => record.reporting_period_start)
    .filter((value): value is string => Boolean(value));
  const ends = imports
    .map((record) => record.reporting_period_end)
    .filter((value): value is string => Boolean(value));

  return {
    start: starts.length > 0 ? [...starts].sort()[0]! : null,
    end: ends.length > 0 ? [...ends].sort().at(-1)! : null,
  };
}
