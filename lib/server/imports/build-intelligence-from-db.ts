import type { FieldMapping } from "@/lib/imports/types";
import type { ImportAnalysisSnapshot } from "@/lib/imports/types";
import { normalizeIntelligenceReport } from "@/lib/analytics/normalize-intelligence";
import type {
  FireExitIntelligenceReport,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import {
  loadDoorProfilesForImport,
  loadParsedEventsForImport,
} from "@/lib/server/db/import-analytics-repository";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export async function buildIntelligenceReportFromImport(
  record: ServerImportRecord,
): Promise<FireExitIntelligenceReport | null> {
  const doors = await loadDoorProfilesForImport(record.id);

  if (doors.length === 0) {
    if (record.analysis_snapshot) {
      const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot;
      return snapshot.intelligence
        ? normalizeIntelligenceReport(snapshot.intelligence)
        : null;
    }

    return null;
  }

  const totalFireExitEvents = doors.reduce(
    (sum, door) => sum + door.totalFireExitEvents,
    0,
  );
  const totalHeldOpenEvents = doors.reduce(
    (sum, door) => sum + door.totalIncidents,
    0,
  );
  const totalExposureSeconds = doors.reduce(
    (sum, door) => sum + door.totalExposureSeconds,
    0,
  );
  const doorsWithViolations = doors.filter((door) => door.totalIncidents > 0).length;
  const excellentDoors = doors.filter((door) => door.status === "Excellent").length;
  const doorsNeedingAttention = doors.filter(
    (door) => door.status === "Needs Attention",
  ).length;
  const criticalDoors = doors.filter((door) => door.status === "Critical").length;

  const overallComplianceScore =
    record.compliance_score_snapshot !== null &&
    record.compliance_score_snapshot !== undefined
      ? Number(record.compliance_score_snapshot)
      : doors.length > 0
        ? Math.round(
            doors.reduce((sum, door) => sum + door.complianceScore, 0) / doors.length,
          )
        : 100;

  const worstDoor =
    [...doors]
      .sort((a, b) => {
        if (a.complianceScore !== b.complianceScore) {
          return a.complianceScore - b.complianceScore;
        }

        return b.totalExposureSeconds - a.totalExposureSeconds;
      })[0]?.door ?? "N/A";

  const mapping = (record.field_mapping ?? {}) as FieldMapping;
  const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot | null;

  const report: FireExitIntelligenceReport = {
    config: snapshot?.intelligence?.config ?? { heldOpenThresholdSeconds: 30 },
    mapping,
    sourceFileName: record.file_name,
    analyzedRowCount: record.row_count,
    analyzedAt: record.created_at,
    doors,
    doorComplianceProfiles: doors
      .map((door) => door.complianceProfile)
      .filter((profile): profile is NonNullable<typeof profile> => !!profile),
    summary: {
      totalDoors: doors.length,
      doorsWithViolations,
      totalFireExitEvents,
      totalHeldOpenEvents,
      totalExposureSeconds,
      totalExposureLabel: formatExposureLabel(totalExposureSeconds),
      overallComplianceScore,
      excellentDoors,
      doorsNeedingAttention,
      criticalDoors,
      worstDoor,
      hasDurationField: record.has_duration_field ?? snapshot?.hasDurationField ?? false,
    },
  };

  return normalizeIntelligenceReport(report);
}

export async function buildImportAnalysisSnapshotFromImport(
  record: ServerImportRecord,
): Promise<ImportAnalysisSnapshot | null> {
  const intelligence = await buildIntelligenceReportFromImport(record);

  if (!intelligence) {
    return null;
  }

  let parsedEvents: ParsedFireExitEvent[] = [];
  try {
    parsedEvents = await loadParsedEventsForImport(record.id);
  } catch {
    const snapshot = record.analysis_snapshot as ImportAnalysisSnapshot | null;
    parsedEvents = snapshot?.parsedEvents ?? [];
  }

  return {
    mapping: intelligence.mapping,
    analyzedRowCount: record.row_count,
    intelligence,
    parsedEvents,
    hasDurationField: intelligence.summary.hasDurationField,
  };
}

function formatExposureLabel(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
