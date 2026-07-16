/**
 * Verify per-import pairing fix for Ground - Adj David Clulow.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDedupedEventsFromImportGroups,
  buildIncidentsByDoorFromImportGroups,
} from "../lib/analytics/build-incidents-from-imports";
import { pairDoorOpenCloseSessions } from "../lib/analytics/door-open-close-pairing";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics/config";
import { groupEventsByDoor } from "../lib/analytics/parse-events";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

const DOOR = "Ground - Adj David Clulow";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
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

async function loadGrouped() {
  const supabase = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: imports } = await supabase
    .from("imports")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);

  const latestId = imports?.[0]?.id;
  if (!latestId) throw new Error("No imports");

  const { data: allImports } = await supabase.from("imports").select("id");
  const importIds = (allImports ?? []).map((row) => row.id);

  const eventsByImportId = new Map<string, ParsedFireExitEvent[]>();
  for (const importId of importIds) {
    const { data } = await supabase
      .from("import_parsed_events")
      .select("door, event_time, event_type, event_timestamp, csv_duration_seconds")
      .eq("import_id", importId)
      .eq("door", DOOR);
    eventsByImportId.set(
      importId,
      (data ?? []).map((row) => ({
        door: row.door,
        eventTime: row.event_time,
        eventType: row.event_type,
        timestamp: row.event_timestamp,
        csvDurationSeconds: row.csv_duration_seconds,
      })),
    );
  }

  const latestEvents = eventsByImportId.get(latestId) ?? [];
  return { latestId, latestEvents, eventsByImportId };
}

async function main() {
  loadEnvLocal();
  const { latestId, latestEvents, eventsByImportId } = await loadGrouped();

  const latestSessions = pairDoorOpenCloseSessions(latestEvents);
  const latestMax = latestSessions.reduce((m, s) => Math.max(m, s.durationSeconds), 0);

  const deduped = buildDedupedEventsFromImportGroups(eventsByImportId);
  const grouped = groupEventsByDoor(deduped);
  const accumulatedSessions = pairDoorOpenCloseSessions(grouped.get(DOOR) ?? []);
  const accumulatedMax = accumulatedSessions.reduce((m, s) => Math.max(m, s.durationSeconds), 0);

  const incidentsByDoor = buildIncidentsByDoorFromImportGroups(
    eventsByImportId,
    DEFAULT_ANALYTICS_CONFIG,
  );
  const clulowIncidents = incidentsByDoor.get(DOOR) ?? [];

  console.log(`Latest import: ${latestId}`);
  console.log(`Latest import max duration: ${latestMax}s`);
  console.log(`Accumulated deduped max duration: ${accumulatedMax}s`);
  console.log(`Incidents after per-import pairing: ${clulowIncidents.length}`);
  for (const incident of clulowIncidents) {
    console.log(
      `  ${incident.startTimeLabel} → ${incident.endTimeLabel} (${incident.durationSeconds}s)`,
    );
  }
}

main().catch(console.error);
