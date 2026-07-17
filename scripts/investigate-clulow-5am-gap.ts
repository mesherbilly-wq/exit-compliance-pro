/**
 * Compare Clulow 05:00-06:00 events in DB vs import provenance.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DOOR = "Ground - Adj David Clulow";
const OPEN_TS = 1784265988000;
const CLOSE_TS = 1784266655000;

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

  console.log("=== INCIDENT EVENT TIMESTAMPS ===");
  console.log("Open ts:", OPEN_TS, new Date(OPEN_TS).toISOString());
  console.log("Close ts:", CLOSE_TS, new Date(CLOSE_TS).toISOString());

  // Every import containing these exact timestamps for ANY door
  for (const ts of [OPEN_TS, CLOSE_TS]) {
    const { data } = await sb
      .from("import_parsed_events")
      .select("import_id, door, event_type, event_time, event_timestamp")
      .eq("event_timestamp", ts);
    console.log(`\n=== ALL ROWS AT ts=${ts} ===`);
    for (const row of data ?? []) {
      const { data: imp } = await sb
        .from("imports")
        .select("file_name, source, created_at")
        .eq("id", row.import_id)
        .single();
      console.log({
        door: row.door,
        eventType: row.event_type,
        eventTime: row.event_time,
        file: imp?.file_name,
        source: imp?.source,
      });
    }
  }

  // Clulow events 5am-6am in ALL imports
  const { data: imports } = await sb
    .from("imports")
    .select("id, file_name, source, created_at, field_mapping, reporting_period_start, reporting_period_end")
    .order("created_at");

  console.log("\n=== CLULOW EVENTS BETWEEN 05:00-06:00 (by event_time text) ===");
  for (const imp of imports ?? []) {
    const { data: events } = await sb
      .from("import_parsed_events")
      .select("event_time, event_type, event_timestamp")
      .eq("import_id", imp.id)
      .eq("door", DOOR)
      .order("event_timestamp");

    const inHour = (events ?? []).filter((event) => {
      const match = event.event_time.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return false;
      let hour = Number(match[1]);
      const ampm = match[4]!.toUpperCase();
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return hour >= 5 && hour < 6;
    });

    if (inHour.length > 0) {
      console.log(`\nFile: ${imp.file_name} | source: ${imp.source} | id: ${imp.id.slice(0, 8)}`);
      for (const event of inHour) {
        console.log(`  ${event.event_time} | ${event.event_type}`);
      }
    }
  }

  // Import metadata for incident source
  const importId = "f50b445d-26c9-40a0-8e7a-98e6cc735f56";
  const { data: sourceImport } = await sb
    .from("imports")
    .select("*")
    .eq("id", importId)
    .single();

  console.log("\n=== INCIDENT SOURCE IMPORT ===");
  console.log(JSON.stringify({
    file_name: sourceImport?.file_name,
    source: sourceImport?.source,
    sender: sourceImport?.sender,
    created_at: sourceImport?.created_at,
    reporting_period_start: sourceImport?.reporting_period_start,
    reporting_period_end: sourceImport?.reporting_period_end,
    row_count: sourceImport?.row_count,
    field_mapping: sourceImport?.field_mapping,
  }, null, 2));

  // Count test vs production imports
  const testImports = (imports ?? []).filter((row) =>
    row.file_name?.toLowerCase().includes("bill test"),
  );
  console.log(`\n=== DATA PROVENANCE ===`);
  console.log(`Total imports: ${imports?.length ?? 0}`);
  console.log(`"bill test" imports: ${testImports.length}`);
  console.log(`Inbound email imports: ${(imports ?? []).filter((r) => r.source === "inbound_email").length}`);
  console.log(`Manual uploads: ${(imports ?? []).filter((r) => r.source === "manual_upload").length}`);
}

main().catch(console.error);
