/**
 * Inspect event types and incident detection in the latest import.
 * Usage: npx tsx scripts/diagnose-latest-import.ts
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
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
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
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: imports, error: importError } = await supabase
    .from("imports")
    .select("id, file_name, created_at, row_count, has_duration_field")
    .order("created_at", { ascending: false })
    .limit(5);

  if (importError) throw new Error(importError.message);
  console.log("Recent imports:");
  for (const imp of imports ?? []) {
    console.log(`  ${imp.created_at} | ${imp.file_name} | ${imp.id} | rows=${imp.row_count}`);
  }

  const latestId = imports?.[0]?.id;
  if (!latestId) {
    console.log("No imports found");
    return;
  }

  const pageSize = 1000;
  const events: ParsedFireExitEvent[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("import_parsed_events")
      .select("door, event_time, event_type, event_timestamp, csv_duration_seconds")
      .eq("import_id", latestId)
      .order("event_timestamp", { ascending: true })
      .range(from, from + pageSize - 1);
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
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  console.log(`\nLatest import events: ${events.length}`);

  const typeCounts = new Map<string, number>();
  for (const e of events) {
    typeCounts.set(e.eventType, (typeCounts.get(e.eventType) ?? 0) + 1);
  }
  console.log("\nEvent types:");
  for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const flags = [
      isDoorOpenedEvent(type) ? "OPEN" : null,
      isDoorClosedEvent(type) ? "CLOSE" : null,
      isHeldOpenEvent(type) ? "HELD" : null,
    ]
      .filter(Boolean)
      .join(",");
    console.log(`  ${count}x ${type}${flags ? ` [${flags}]` : ""}`);
  }

  const heldLike = events.filter((e) => isHeldOpenEvent(e.eventType));
  console.log(`\nHeld-open matched events: ${heldLike.length}`);
  if (heldLike.length > 0) {
    console.log("Sample held-open events:");
    for (const e of heldLike.slice(0, 10)) {
      console.log(
        `  ${e.door} | ${e.eventTime} | ${e.eventType} | csvDuration=${e.csvDurationSeconds}`,
      );
    }
  }

  const grouped = groupEventsByDoor(events);
  let totalIncidents = 0;
  const doorsWithIncidents: Array<{ door: string; count: number }> = [];

  for (const [door, doorEvents] of grouped) {
    const incidents = buildComplianceIncidents(doorEvents, DEFAULT_ANALYTICS_CONFIG);
    if (incidents.length > 0) {
      totalIncidents += incidents.length;
      doorsWithIncidents.push({ door, count: incidents.length });
    }
  }

  console.log(`\nIncidents detected (current logic): ${totalIncidents}`);
  doorsWithIncidents.sort((a, b) => b.count - a.count);
  for (const d of doorsWithIncidents.slice(0, 15)) {
    console.log(`  ${d.count}x ${d.door}`);
  }

  // Also show what open-close >30s would find (old logic)
  let implicitCount = 0;
  for (const [, doorEvents] of grouped) {
    let openStart: ParsedFireExitEvent | null = null;
    for (const event of doorEvents) {
      if (isDoorOpenedEvent(event.eventType)) {
        openStart = event;
        continue;
      }
      if (isDoorClosedEvent(event.eventType) && openStart) {
        const dur = (event.timestamp - openStart.timestamp) / 1000;
        if (dur > DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds) {
          implicitCount++;
        }
        openStart = null;
      }
    }
  }
  console.log(`\nOpen→close sessions >30s (no alarm required): ${implicitCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
