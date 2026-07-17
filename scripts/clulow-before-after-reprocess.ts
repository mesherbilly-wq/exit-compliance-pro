/**
 * Capture Ground - Adj David Clulow incident counts before/after reprocess.
 * Usage: npx tsx scripts/clulow-before-after-reprocess.ts [--reprocess]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANALYTICS_ENGINE_VERSION } from "../lib/analytics/analytics-engine-version";
import { buildCanonicalIncidentsByDoor } from "../lib/analytics/canonical-incident-engine";
import { dedupeIncidents } from "../lib/analytics/dedupe-parsed-events";
import { refreshAllImportAnalysisSnapshots } from "../lib/server/imports/import-service";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

const DOOR = "Ground - Adj David Clulow";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }

  process.env.RESEND_API_KEY =
    process.env.RESEND_API_KEY?.trim() || "re_test_key";
  process.env.RESEND_WEBHOOK_SECRET =
    process.env.RESEND_WEBHOOK_SECRET?.trim() || "whsec_test_secret";
  process.env.SUPABASE_STORAGE_BUCKET =
    process.env.SUPABASE_STORAGE_BUCKET?.trim() || "imports";
  process.env.INBOUND_REPORT_EMAIL =
    process.env.INBOUND_REPORT_EMAIL?.trim() || "reports@inbound.example.com";
}

async function loadClulowData() {
  const supabase = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: imports, error: importsError } = await supabase
    .from("imports")
    .select(
      "id, created_at, reporting_period_start, reporting_period_end, analytics_engine_version, analytics_threshold_seconds, incident_count",
    )
    .order("created_at", { ascending: true });

  if (importsError) throw importsError;

  const { data: storedIncidents, error: storedError } = await supabase
    .from("import_incidents")
    .select(
      "id, import_id, door, start_timestamp, end_timestamp, start_time_label, end_time_label, duration_seconds, classification, analytics_engine_version, event_type",
    )
    .eq("door", DOOR);

  if (storedError) throw storedError;

  const eventsByImportId = new Map<string, ParsedFireExitEvent[]>();
  const importContexts = new Map<
    string,
    {
      importId: string;
      reportingPeriodStart: string | null;
      reportingPeriodEnd: string | null;
      createdAt: string;
    }
  >();

  for (const row of imports ?? []) {
    importContexts.set(row.id, {
      importId: row.id,
      reportingPeriodStart: row.reporting_period_start,
      reportingPeriodEnd: row.reporting_period_end,
      createdAt: row.created_at,
    });

    const { data: events, error: eventsError } = await supabase
      .from("import_parsed_events")
      .select(
        "door, event_time, event_type, event_timestamp, csv_duration_seconds, source_row_number, source_sequence, source_event_id, source_system, site",
      )
      .eq("import_id", row.id)
      .eq("door", DOOR);

    if (eventsError) throw eventsError;

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
        sourceEventId: event.source_event_id ?? undefined,
        sourceSystem: event.source_system ?? undefined,
        site: event.site ?? undefined,
      })),
    );
  }

  const thresholdArg = process.argv.find((arg) => arg.startsWith("--threshold="));
  const threshold = thresholdArg
    ? Number(thresholdArg.split("=")[1])
    : (imports?.find((row) => row.analytics_threshold_seconds != null)
        ?.analytics_threshold_seconds ?? 300);

  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId,
    importContexts,
    config: { heldOpenThresholdSeconds: threshold },
    includeTrace: true,
  });

  const liveIncidents = canonical.incidentsByDoor.get(DOOR) ?? [];
  const storedDeduped = dedupeIncidents(
    (storedIncidents ?? []).map((row) => ({
      door: row.door,
      startTimestamp: row.start_timestamp,
      endTimestamp: row.end_timestamp,
      startTimeLabel: row.start_time_label,
      endTimeLabel: row.end_time_label,
      durationSeconds: row.duration_seconds,
      thresholdSeconds: threshold,
      timeBeyondThresholdSeconds: 0,
      riskRating: "low" as const,
      durationBucket: "brief" as const,
      dayStarted: "",
      hourStarted: 0,
      isExplicitAlarm: false,
      eventType: row.event_type,
      classification: row.classification ?? undefined,
    })),
  );

  return {
    importCount: imports?.length ?? 0,
    storedIncidents: storedIncidents ?? [],
    storedDedupedCount: storedDeduped.length,
    liveIncidents,
    threshold,
    diagnostics: canonical.diagnostics,
  };
}

async function applyMigrationIfNeeded() {
  const supabase = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const migrationSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/004_analytics_engine_v2.sql"),
    "utf8",
  );

  const { error } = await supabase.rpc("exec_sql", { sql: migrationSql }).maybeSingle();
  if (error) {
    console.log(
      "Migration via RPC unavailable (apply 004_analytics_engine_v2.sql manually if columns missing).",
    );
    console.log(`  ${error.message}`);
  } else {
    console.log("Migration 004 applied.");
  }
}

function printIncidents(label: string, incidents: Array<{ startTimeLabel?: string; endTimeLabel?: string; durationSeconds?: number; classification?: string }>) {
  console.log(`\n${label}: ${incidents.length}`);
  for (const incident of incidents.sort((a, b) => (a.startTimeLabel ?? "").localeCompare(b.startTimeLabel ?? ""))) {
    console.log(
      `  ${incident.startTimeLabel} → ${incident.endTimeLabel} (${incident.durationSeconds}s) [${incident.classification ?? "unknown"}]`,
    );
  }
}

async function main() {
  loadEnvLocal();
  const shouldReprocess = process.argv.includes("--reprocess");

  console.log(`Analytics engine version: ${ANALYTICS_ENGINE_VERSION}`);
  console.log(`Door: ${DOOR}`);

  const before = await loadClulowData();
  console.log(`Imports loaded: ${before.importCount}`);
  console.log(`Threshold: ${before.threshold}s`);

  printIncidents("Stored import_incidents (before)", before.storedIncidents.map((row) => ({
    startTimeLabel: row.start_time_label,
    endTimeLabel: row.end_time_label,
    durationSeconds: row.duration_seconds,
    classification: row.classification ?? undefined,
  })));

  printIncidents("Live canonical recalc (before reprocess)", before.liveIncidents);

  if (shouldReprocess) {
    await applyMigrationIfNeeded();
    console.log("\nReprocessing all imports...");
    const result = await refreshAllImportAnalysisSnapshots({
      heldOpenThresholdSeconds: before.threshold,
    });
    console.log(`Reprocess complete: refreshed=${result.refreshed}, skipped=${result.skipped}`);

    const after = await loadClulowData();
    printIncidents("Stored import_incidents (after)", after.storedIncidents.map((row) => ({
      startTimeLabel: row.start_time_label,
      endTimeLabel: row.end_time_label,
      durationSeconds: row.duration_seconds,
      classification: row.classification ?? undefined,
    })));
    printIncidents("Live canonical recalc (after reprocess)", after.liveIncidents);

    console.log("\nSummary:");
    console.log(`  Stored rows before: ${before.storedIncidents.length}`);
    console.log(`  Stored deduped before: ${before.storedDedupedCount}`);
    console.log(`  Live before:   ${before.liveIncidents.length}`);
    console.log(`  Stored rows after:  ${after.storedIncidents.length}`);
    console.log(`  Stored deduped after: ${after.storedDedupedCount}`);
    console.log(`  Live after:    ${after.liveIncidents.length}`);
    console.log(
      `  Stored/live match after: ${after.storedDedupedCount === after.liveIncidents.length}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
