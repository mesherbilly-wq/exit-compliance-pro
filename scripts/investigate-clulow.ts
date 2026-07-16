/**
 * Investigate Ground - Adj David Clulow pairing in latest vs accumulated imports.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildComplianceIncidents } from "../lib/analytics/compliance-incidents";
import { groupEventsByDoor } from "../lib/analytics/parse-events";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics/config";
import {
  isDoorClosedEvent,
  isDoorOpenedEvent,
} from "../lib/reports/door-event-analysis";
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function pairOpenClose(events: ParsedFireExitEvent[], label: string) {
  console.log(`\n=== ${label} (${events.length} events) ===`);
  let openStart: ParsedFireExitEvent | null = null;
  const pairs: Array<{ open: ParsedFireExitEvent; close: ParsedFireExitEvent; duration: number }> = [];

  for (const event of events) {
    if (isDoorOpenedEvent(event.eventType)) {
      if (openStart) {
        console.log(`  WARN duplicate open without close: pending ${openStart.eventTime} replaced by ${event.eventTime}`);
      }
      openStart = event;
      continue;
    }
    if (isDoorClosedEvent(event.eventType)) {
      if (!openStart) {
        console.log(`  WARN orphan close: ${event.eventTime}`);
        continue;
      }
      const duration = (event.timestamp - openStart.timestamp) / 1000;
      pairs.push({ open: openStart, close: event, duration });
      console.log(
        `  PAIR open=${openStart.eventTime} close=${event.eventTime} duration=${duration.toFixed(1)}s`,
      );
      openStart = null;
    }
  }
  if (openStart) {
    console.log(`  WARN unclosed open: ${openStart.eventTime}`);
  }

  const max = pairs.reduce((m, p) => Math.max(m, p.duration), 0);
  console.log(`  Max duration: ${max.toFixed(1)}s, pairs: ${pairs.length}`);
  return pairs;
}

async function main() {
  loadEnvLocal();
  const supabase = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: imports } = await supabase
    .from("imports")
    .select("id, file_name, created_at, row_count")
    .order("created_at", { ascending: false })
    .limit(3);

  const latestId = imports?.[0]?.id;
  console.log("Latest imports:");
  for (const imp of imports ?? []) {
    console.log(`  ${imp.created_at} | ${imp.file_name} | ${imp.id}`);
  }

  async function loadEvents(importId?: string) {
    const events: (ParsedFireExitEvent & { importId?: string })[] = [];
    let from = 0;
    while (true) {
      let q = supabase
        .from("import_parsed_events")
        .select("import_id, door, event_time, event_type, event_timestamp, csv_duration_seconds")
        .eq("door", DOOR)
        .order("event_timestamp", { ascending: true })
        .range(from, from + 999);
      if (importId) q = q.eq("import_id", importId);
      const { data, error } = await q;
      if (error) throw error;
      const batch = data ?? [];
      for (const row of batch) {
        events.push({
          importId: row.import_id,
          door: row.door,
          eventTime: row.event_time,
          eventType: row.event_type,
          timestamp: row.event_timestamp,
          csvDurationSeconds: row.csv_duration_seconds,
        });
      }
      if (batch.length < 1000) break;
      from += 1000;
    }
    return events;
  }

  const latestOnly = await loadEvents(latestId);
  const allAccumulated = await loadEvents();

  pairOpenClose(latestOnly, "Latest import only");
  pairOpenClose(allAccumulated, "All imports accumulated");

  const groupedLatest = groupEventsByDoor(latestOnly);
  const groupedAll = groupEventsByDoor(allAccumulated);
  const incidentsLatest = buildComplianceIncidents(
    groupedLatest.get(DOOR) ?? [],
    DEFAULT_ANALYTICS_CONFIG,
  );
  const incidentsAll = buildComplianceIncidents(
    groupedAll.get(DOOR) ?? [],
    DEFAULT_ANALYTICS_CONFIG,
  );

  console.log(`\nIncidents latest import: ${incidentsLatest.length}`);
  for (const i of incidentsLatest) {
    console.log(`  ${i.startTimeLabel} → ${i.endTimeLabel} dur=${i.durationSeconds}s beyond=${i.timeBeyondThresholdSeconds}s`);
  }
  console.log(`Incidents accumulated: ${incidentsAll.length}`);
  for (const i of incidentsAll) {
    console.log(`  ${i.startTimeLabel} → ${i.endTimeLabel} dur=${i.durationSeconds}s beyond=${i.timeBeyondThresholdSeconds}s`);
  }

  // Check stored incidents
  const { data: stored } = await supabase
    .from("import_incidents")
    .select("import_id, start_time_label, end_time_label, duration_seconds, time_beyond_threshold_seconds")
    .eq("door", DOOR)
    .order("duration_seconds", { ascending: false })
    .limit(10);

  console.log("\nStored import_incidents (top by duration):");
  for (const row of stored ?? []) {
    console.log(
      `  import=${row.import_id?.slice(0, 8)}... ${row.start_time_label} → ${row.end_time_label} dur=${row.duration_seconds}s`,
    );
  }

  // Show events around 01:52-02:16 in latest import
  console.log("\nLatest import events 01:52-02:20:");
  for (const e of latestOnly) {
    if (/1:5[0-9]|2:0[0-9]|2:1[0-9]|2:20/.test(e.eventTime) || /01:5|02:0|02:1|02:2/.test(e.eventTime)) {
      console.log(`  ${e.eventTime} | ${e.eventType} | ts=${e.timestamp}`);
    }
  }
}

main().catch(console.error);
