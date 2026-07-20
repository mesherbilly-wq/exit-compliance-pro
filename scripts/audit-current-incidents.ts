/**
 * Audit all current incidents after fresh import reset.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { buildCanonicalIncidentsByDoor } from "../lib/analytics/canonical-incident-engine";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  if (!process.env[t.slice(0, eq).trim()]) {
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: imports } = await sb
    .from("imports")
    .select(
      "id, file_name, source, created_at, incident_count, analytics_threshold_seconds, reporting_period_start, reporting_period_end, row_count",
    )
    .order("created_at", { ascending: true });

  console.log(`=== IMPORTS (${imports?.length ?? 0}) ===`);
  let totalStored = 0;
  for (const row of imports ?? []) {
    totalStored += row.incident_count ?? 0;
    console.log(
      `${row.file_name} | incidents=${row.incident_count} | threshold=${row.analytics_threshold_seconds ?? "?"}s | rows=${row.row_count}`,
    );
  }
  console.log(`Sum of per-import incident_count: ${totalStored}`);

  const { data: storedIncidents } = await sb
    .from("import_incidents")
    .select(
      "door, start_time_label, end_time_label, duration_seconds, threshold_seconds, classification, event_type, import_id",
    )
    .order("start_timestamp");

  console.log(`\n=== STORED INCIDENTS (${storedIncidents?.length ?? 0}) ===`);
  const latestImportId = imports?.at(-1)?.id;
  console.log(`Latest import id: ${latestImportId}`);
  for (const row of storedIncidents ?? []) {
    const imp = imports?.find((i) => i.id === row.import_id);
    const stale = row.import_id !== latestImportId ? " [STALE IMPORT ID]" : "";
    console.log(
      `${row.door} | ${row.start_time_label} → ${row.end_time_label} | ${row.duration_seconds}s | ${imp?.file_name ?? "ORPHAN"}${stale}`,
    );
  }

  const importContexts = new Map<
    string,
    {
      importId: string;
      reportingPeriodStart: string | null;
      reportingPeriodEnd: string | null;
      createdAt: string;
    }
  >();
  const eventsByImportId = new Map<string, ParsedFireExitEvent[]>();

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
      .order("event_timestamp");
    eventsByImportId.set(
      row.id,
      (events ?? []).map((e) => ({
        door: e.door,
        eventTime: e.event_time,
        eventType: e.event_type,
        timestamp: e.event_timestamp,
        csvDurationSeconds: e.csv_duration_seconds,
        sourceImportId: row.id,
        sourceRowNumber: e.source_row_number ?? undefined,
        sourceSequence: e.source_sequence ?? undefined,
      })),
    );
  }

  const threshold =
    imports?.find((r) => r.analytics_threshold_seconds != null)
      ?.analytics_threshold_seconds ?? 300;

  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId,
    importContexts,
    config: { heldOpenThresholdSeconds: threshold },
    includeTrace: true,
  });

  let liveTotal = 0;
  console.log(`\n=== LIVE CANONICAL INCIDENTS (threshold=${threshold}s) ===`);
  for (const [door, incidents] of [...canonical.incidentsByDoor.entries()].sort()) {
    liveTotal += incidents.length;
    for (const inc of incidents) {
      console.log(
        `${door} | ${inc.startTimeLabel} → ${inc.endTimeLabel} | ${inc.durationSeconds}s | open=${inc.trace?.openEventType} @ ${inc.trace?.openSourceImportId?.slice(0, 8)} | close @ ${inc.trace?.closeSourceImportId?.slice(0, 8)}`,
      );
    }
  }
  console.log(`Live canonical total: ${liveTotal}`);

  // Clulow focus
  const CLULOW = "Ground - Adj David Clulow";
  const clulowEvents = [...eventsByImportId.values()].flat().filter((e) => e.door === CLULOW);
  console.log(`\n=== CLULOW: ${clulowEvents.length} parsed events across all imports ===`);
  const clulowIncidents = canonical.incidentsByDoor.get(CLULOW) ?? [];
  console.log(`CLULOW incidents: ${clulowIncidents.length}`);
  for (const inc of clulowIncidents) {
    const openTs = inc.endTimestamp - inc.durationSeconds * 1000;
    const open = clulowEvents.find((e) => e.timestamp === openTs && e.eventType === "Door opened");
    const close = clulowEvents.find((e) => e.timestamp === inc.endTimestamp && e.eventType === "Door closed");
    console.log(`\n  INCIDENT ${inc.durationSeconds}s:`);
    console.log(`    OPEN:  ${open?.eventTime ?? "?"} (${open?.sourceImportId?.slice(0, 8)})`);
    console.log(`    CLOSE: ${close?.eventTime ?? "?"} (${close?.sourceImportId?.slice(0, 8)})`);
  }
}

main().catch(console.error);
