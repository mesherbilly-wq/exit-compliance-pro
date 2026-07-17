import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { buildCanonicalIncidentsByDoor } from "../lib/analytics/canonical-incident-engine";
import { runFireExitIntelligenceFromParsedEvents } from "../lib/analytics/fire-exit-intelligence-engine";
import { persistImportAnalytics } from "../lib/server/db/import-analytics-repository";
import {
  attributeIncidentToImportId,
  filterIncidentsByDoorForImport,
} from "../lib/server/imports/rebuild-canonical-analytics";
import type { FieldMapping } from "../lib/imports/types";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

const DOOR = "Ground - Adj David Clulow";
const TARGET = "577cc521";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  if (!process.env[t.slice(0, eq).trim()]) {
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

process.env.RESEND_WEBHOOK_SECRET =
  process.env.RESEND_WEBHOOK_SECRET?.trim() || "whsec_test_secret";
process.env.RESEND_API_KEY =
  process.env.RESEND_API_KEY?.trim() || "re_test_key";
process.env.SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "imports";
process.env.INBOUND_REPORT_EMAIL =
  process.env.INBOUND_REPORT_EMAIL?.trim() || "reports@example.com";

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: imports } = await sb
    .from("imports")
    .select("id, headers, file_name, row_count, has_duration_field, field_mapping, created_at, reporting_period_start, reporting_period_end")
    .order("created_at");

  const eventsByImportId = new Map<string, ParsedFireExitEvent[]>();
  const importContexts = new Map<string, {
    importId: string;
    reportingPeriodStart: string | null;
    reportingPeriodEnd: string | null;
    createdAt: string;
  }>();

  for (const row of imports ?? []) {
    importContexts.set(row.id, {
      importId: row.id,
      reportingPeriodStart: row.reporting_period_start,
      reportingPeriodEnd: row.reporting_period_end,
      createdAt: row.created_at,
    });

    const { data: events } = await sb
      .from("import_parsed_events")
      .select("*")
      .eq("import_id", row.id)
      .eq("door", DOOR);

    eventsByImportId.set(
      row.id,
      (events ?? []).map((event) => ({
        door: event.door,
        eventTime: event.event_time,
        eventType: event.event_type,
        timestamp: event.event_timestamp,
        csvDurationSeconds: event.csv_duration_seconds,
        sourceImportId: row.id,
        sourceRowNumber: event.source_row_number ?? undefined,
        sourceSequence: event.source_sequence ?? undefined,
      })),
    );
  }

  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId,
    importContexts,
    config: { heldOpenThresholdSeconds: 300 },
    includeTrace: true,
  });

  const live = canonical.incidentsByDoor.get(DOOR) ?? [];
  console.log("global live", live.length);
  for (const incident of live) {
    console.log(
      " ",
      incident.endTimeLabel,
      "attr",
      attributeIncidentToImportId(incident),
    );
  }

  const record = (imports ?? []).find((row) => row.id.startsWith(TARGET));
  if (!record) {
    throw new Error("Target import not found");
  }

  const importEvents = eventsByImportId.get(record.id) ?? [];
  const owned = filterIncidentsByDoorForImport(canonical.incidentsByDoor, record.id);
  console.log("owned clulow", owned.get(DOOR)?.length ?? 0);

  const artifacts = runFireExitIntelligenceFromParsedEvents(
    importEvents,
    record.headers,
    [],
    {
      sourceFileName: record.file_name,
      config: { heldOpenThresholdSeconds: 300 },
      analyzedRowCount: record.row_count,
      hasDurationField: record.has_duration_field ?? false,
      mapping: (record.field_mapping ?? {}) as FieldMapping,
      incidentsByDoor: owned,
    },
  );

  const door = artifacts.report.doors.find((entry) => entry.door === DOOR);
  console.log("report clulow incidents", door?.incidents.length ?? 0);

  const analytics = await persistImportAnalytics({
    importId: record.id,
    intelligence: artifacts.report,
    parsedEvents: importEvents,
    analyticsThresholdSeconds: 300,
  });
  console.log("persisted incidentCount", analytics.incidentCount);

  const { data: stored } = await sb
    .from("import_incidents")
    .select("end_time_label")
    .eq("import_id", record.id)
    .eq("door", DOOR);
  console.log("db clulow rows", stored?.length);
}

main().catch(console.error);
