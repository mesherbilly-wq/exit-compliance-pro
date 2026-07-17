import type { IncidentClassification } from "./incident-classification";
import type { ComplianceIncident, ParsedFireExitEvent } from "./types";

export type IncidentTrace = {
  openSourceImportId: string | null;
  openSourceRowNumber: number | null;
  closeSourceImportId: string | null;
  closeSourceRowNumber: number | null;
  sourceImportIds: string[];
  openEventType: string;
  closeEventType: string;
  fullOpenDurationSeconds: number;
  thresholdSeconds: number;
  timeBeyondThresholdSeconds: number;
  qualificationReason: string;
  classification: IncidentClassification;
};

export type IncidentEngineDiagnostics = {
  orphanCloses: ParsedFireExitEvent[];
  expiredUnmatchedOpens: ParsedFireExitEvent[];
  crossImportPairs: number;
};

export function buildIncidentTrace(input: {
  openEvent: ParsedFireExitEvent;
  closeEvent: ParsedFireExitEvent;
  durationSeconds: number;
  thresholdSeconds: number;
  timeBeyondThresholdSeconds: number;
  classification: IncidentClassification;
  qualificationReason: string;
}): IncidentTrace {
  const sourceImportIds = [
    ...new Set(
      [input.openEvent.sourceImportId, input.closeEvent.sourceImportId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];

  return {
    openSourceImportId: input.openEvent.sourceImportId ?? null,
    openSourceRowNumber: input.openEvent.sourceRowNumber ?? null,
    closeSourceImportId: input.closeEvent.sourceImportId ?? null,
    closeSourceRowNumber: input.closeEvent.sourceRowNumber ?? null,
    sourceImportIds,
    openEventType: input.openEvent.eventType,
    closeEventType: input.closeEvent.eventType,
    fullOpenDurationSeconds: input.durationSeconds,
    thresholdSeconds: input.thresholdSeconds,
    timeBeyondThresholdSeconds: input.timeBeyondThresholdSeconds,
    qualificationReason: input.qualificationReason,
    classification: input.classification,
  };
}

export function formatIncidentTrace(trace: IncidentTrace): string {
  return [
    `classification=${trace.classification}`,
    `reason=${trace.qualificationReason}`,
    `open=${trace.openEventType} (import=${trace.openSourceImportId ?? "n/a"}, row=${trace.openSourceRowNumber ?? "n/a"})`,
    `close=${trace.closeEventType} (import=${trace.closeSourceImportId ?? "n/a"}, row=${trace.closeSourceRowNumber ?? "n/a"})`,
    `duration=${trace.fullOpenDurationSeconds}s threshold=${trace.thresholdSeconds}s beyond=${trace.timeBeyondThresholdSeconds}s`,
    `imports=[${trace.sourceImportIds.join(", ")}]`,
  ].join(" | ");
}

export function getIncidentTrace(incident: ComplianceIncident): IncidentTrace | null {
  return incident.trace ?? null;
}
