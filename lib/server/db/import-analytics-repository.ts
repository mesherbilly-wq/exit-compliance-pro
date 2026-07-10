import { getSupabaseAdmin } from "@/lib/server/supabase/admin";
import type {
  ImportDailyStatisticRow,
  ImportDoorComplianceRow,
  ImportHourlyStatisticRow,
  ImportIncidentRow,
  ImportParsedEventRow,
  ProcessingLogEntry,
} from "@/lib/server/types/import-management";
import type {
  ComplianceIncident,
  DoorIntelligenceProfile,
  ParsedFireExitEvent,
} from "@/lib/analytics/types";
import type { FireExitIntelligenceReport } from "@/lib/analytics/types";

const PARSED_EVENT_BATCH_SIZE = 500;
const INCIDENT_BATCH_SIZE = 200;

export async function clearImportAnalytics(importId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const tables = [
    "import_parsed_events",
    "import_incidents",
    "import_hourly_statistics",
    "import_daily_statistics",
    "import_door_compliance",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("import_id", importId);
    if (error) {
      throw new Error(`Failed to clear ${table}: ${error.message}`);
    }
  }
}

function incidentToRow(
  importId: string,
  incident: ComplianceIncident,
): Omit<ImportIncidentRow, "id"> {
  return {
    import_id: importId,
    door: incident.door,
    start_timestamp: incident.startTimestamp,
    end_timestamp: incident.endTimestamp,
    start_time_label: incident.startTimeLabel,
    end_time_label: incident.endTimeLabel,
    duration_seconds: incident.durationSeconds,
    threshold_seconds: incident.thresholdSeconds,
    time_beyond_threshold_seconds: incident.timeBeyondThresholdSeconds,
    risk_rating: incident.riskRating,
    duration_bucket: incident.durationBucket,
    day_started: incident.dayStarted,
    hour_started: incident.hourStarted,
    is_explicit_alarm: incident.isExplicitAlarm,
    event_type: incident.eventType,
  };
}

function parsedEventToRow(
  importId: string,
  event: ParsedFireExitEvent,
): ImportParsedEventRow {
  return {
    import_id: importId,
    door: event.door,
    event_time: event.eventTime,
    event_type: event.eventType,
    event_timestamp: event.timestamp,
    csv_duration_seconds: event.csvDurationSeconds,
  };
}

async function insertInBatches(
  table: string,
  rows: Record<string, unknown>[],
  batchSize: number,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from(table).insert(batch as never);
    if (error) {
      throw new Error(`Failed to insert into ${table}: ${error.message}`);
    }
  }
}

export type PersistImportAnalyticsInput = {
  importId: string;
  intelligence: FireExitIntelligenceReport;
  parsedEvents: ParsedFireExitEvent[];
};

export type PersistImportAnalyticsResult = {
  doorCount: number;
  incidentCount: number;
  complianceScoreSnapshot: number;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
};

export async function persistImportAnalytics(
  input: PersistImportAnalyticsInput,
): Promise<PersistImportAnalyticsResult> {
  const { importId, intelligence, parsedEvents } = input;

  await clearImportAnalytics(importId);

  const incidentRows = intelligence.doors.flatMap((door) =>
    door.incidents.map((incident) => incidentToRow(importId, incident)),
  );

  const hourlyRows: ImportHourlyStatisticRow[] = intelligence.doors.flatMap((door) =>
    door.timeOfDayDistribution.map((bucket) => ({
      import_id: importId,
      door: door.door,
      hour_label: bucket.label,
      incident_count: bucket.count,
      exposure_seconds: bucket.exposureSeconds,
    })),
  );

  const dailyRows: ImportDailyStatisticRow[] = intelligence.doors.flatMap((door) =>
    door.dayOfWeekDistribution.map((bucket) => ({
      import_id: importId,
      door: door.door,
      day_label: bucket.label,
      incident_count: bucket.count,
      exposure_seconds: bucket.exposureSeconds,
    })),
  );

  const doorComplianceRows: ImportDoorComplianceRow[] = intelligence.doors.map(
    (door) => ({
      import_id: importId,
      door: door.door,
      compliance_score: door.complianceScore,
      compliance_rating: door.complianceProfile?.complianceRating ?? door.status,
      total_incidents: door.totalIncidents,
      total_fire_exit_events: door.totalFireExitEvents,
      total_exposure_seconds: door.totalExposureSeconds,
      status: door.status,
      profile_data: door as unknown as Record<string, unknown>,
    }),
  );

  const parsedEventRows = parsedEvents.map((event) =>
    parsedEventToRow(importId, event),
  );

  await insertInBatches("import_incidents", incidentRows, INCIDENT_BATCH_SIZE);
  await insertInBatches("import_hourly_statistics", hourlyRows, INCIDENT_BATCH_SIZE);
  await insertInBatches("import_daily_statistics", dailyRows, INCIDENT_BATCH_SIZE);
  await insertInBatches("import_door_compliance", doorComplianceRows, INCIDENT_BATCH_SIZE);
  await insertInBatches(
    "import_parsed_events",
    parsedEventRows,
    PARSED_EVENT_BATCH_SIZE,
  );

  const timestamps = parsedEvents
    .map((event) => event.timestamp)
    .filter((value) => Number.isFinite(value));

  const reportingPeriodStart =
    timestamps.length > 0
      ? new Date(Math.min(...timestamps)).toISOString()
      : null;
  const reportingPeriodEnd =
    timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;

  return {
    doorCount: intelligence.summary.totalDoors,
    incidentCount: intelligence.summary.totalHeldOpenEvents,
    complianceScoreSnapshot: intelligence.summary.overallComplianceScore,
    reportingPeriodStart,
    reportingPeriodEnd,
  };
}

export async function loadParsedEventsForImport(
  importId: string,
): Promise<ParsedFireExitEvent[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("import_parsed_events")
    .select("door, event_time, event_type, event_timestamp, csv_duration_seconds")
    .eq("import_id", importId)
    .order("event_timestamp", { ascending: true });

  if (error) {
    throw new Error(`Failed to load parsed events: ${error.message}`);
  }

  return ((data as ImportParsedEventRow[]) ?? []).map((row) => ({
    door: row.door,
    eventTime: row.event_time,
    eventType: row.event_type,
    timestamp: row.event_timestamp,
    csvDurationSeconds: row.csv_duration_seconds,
  }));
}

export async function loadDoorProfilesForImport(
  importId: string,
): Promise<DoorIntelligenceProfile[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("import_door_compliance")
    .select("profile_data, door")
    .eq("import_id", importId)
    .order("door", { ascending: true });

  if (error) {
    throw new Error(`Failed to load door compliance profiles: ${error.message}`);
  }

  return ((data as { profile_data: DoorIntelligenceProfile; door: string }[]) ?? []).map(
    (row) => row.profile_data,
  );
}

export async function appendProcessingLog(
  importId: string,
  entries: ProcessingLogEntry[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data, error: loadError } = await supabase
    .from("imports")
    .select("processing_log")
    .eq("id", importId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load processing log: ${loadError.message}`);
  }

  const existing = ((data as { processing_log?: ProcessingLogEntry[] } | null)
    ?.processing_log ?? []) as ProcessingLogEntry[];

  const { error } = await supabase
    .from("imports")
    .update({ processing_log: [...existing, ...entries] })
    .eq("id", importId);

  if (error) {
    throw new Error(`Failed to update processing log: ${error.message}`);
  }
}
