/**
 * Full analytics diagnostic across all imports.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildComplianceIncidents } from "../lib/analytics/compliance-incidents";
import { groupEventsByDoor } from "../lib/analytics/parse-events";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics/config";
import { isHeldOpenEvent } from "../lib/reports/held-open-detection";
import { isDoorClosedEvent, isDoorOpenedEvent } from "../lib/reports/door-event-analysis";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

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

async function loadEvents(supabase: ReturnType<typeof createClient>, importId?: string) {
  const events: ParsedFireExitEvent[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("import_parsed_events")
      .select("import_id, door, event_time, event_type, event_timestamp, csv_duration_seconds")
      .order("event_timestamp", { ascending: true })
      .range(from, from + 999);
    if (importId) query = query.eq("import_id", importId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      events.push({
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

function countIncidents(events: ParsedFireExitEvent[]) {
  const grouped = groupEventsByDoor(events);
  let total = 0;
  for (const [, doorEvents] of grouped) {
    total += buildComplianceIncidents(doorEvents, DEFAULT_ANALYTICS_CONFIG).length;
  }
  return total;
}

function countImplicit(events: ParsedFireExitEvent[]) {
  const grouped = groupEventsByDoor(events);
  let total = 0;
  for (const [, doorEvents] of grouped) {
    let openStart: ParsedFireExitEvent | null = null;
    for (const event of doorEvents) {
      if (isDoorOpenedEvent(event.eventType)) {
        openStart = event;
        continue;
      }
      if (isDoorClosedEvent(event.eventType) && openStart) {
        const dur = (event.timestamp - openStart.timestamp) / 1000;
        if (dur > DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds) total++;
        openStart = null;
      }
    }
  }
  return total;
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
    .order("created_at", { ascending: false });

  const latestId = imports?.[0]?.id;
  console.log(`Total imports: ${imports?.length ?? 0}`);
  console.log(`Latest: ${imports?.[0]?.file_name} (${imports?.[0]?.row_count} rows)`);

  const allEvents = await loadEvents(supabase);
  const latestEvents = latestId ? await loadEvents(supabase, latestId) : [];

  const allTypes = new Map<string, number>();
  for (const e of allEvents) {
    allTypes.set(e.eventType, (allTypes.get(e.eventType) ?? 0) + 1);
  }
  console.log(`\nAll accumulated event types (${allEvents.length} events):`);
  for (const [t, c] of [...allTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${c}x ${t}${isHeldOpenEvent(t) ? " [HELD]" : ""}`);
  }

  console.log(`\nIncidents (current logic):`);
  console.log(`  Latest import only: ${countIncidents(latestEvents)}`);
  console.log(`  All imports accumulated: ${countIncidents(allEvents)}`);

  console.log(`\nOpen→close >30s (implicit):`);
  console.log(`  Latest import only: ${countImplicit(latestEvents)}`);
  console.log(`  All imports accumulated: ${countImplicit(allEvents)}`);

  const { data: storedIncidents, count } = await supabase
    .from("import_incidents")
    .select("id", { count: "exact", head: true });
  console.log(`\nStored import_incidents rows in DB: ${count ?? storedIncidents?.length ?? 0}`);

  if (latestId) {
    const { count: latestCount } = await supabase
      .from("import_incidents")
      .select("id", { count: "exact", head: true })
      .eq("import_id", latestId);
    console.log(`Stored incidents for latest import: ${latestCount ?? 0}`);
  }
}

main().catch(console.error);
