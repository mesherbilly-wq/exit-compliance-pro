/**
 * One-off diagnostic: inspect parsed events and incidents for a door/date.
 * Usage: npx tsx scripts/diagnose-door-events.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildComplianceIncidents } from "../lib/analytics/compliance-incidents";
import { groupEventsByDoor } from "../lib/analytics/parse-events";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics/config";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

const DOOR_QUERY = "Ground - Adj David Clulow";
const DATE_QUERY = "2026-07-15";

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function isOnDate(timestamp: number, dateKey: string): boolean {
  const d = new Date(timestamp);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return key === dateKey;
}

function formatTs(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(timestamp));
}

async function loadAllParsedEvents(): Promise<ParsedFireExitEvent[]> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pageSize = 1000;
  const allRows: ParsedFireExitEvent[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("import_parsed_events")
      .select("door, event_time, event_type, event_timestamp, csv_duration_seconds")
      .order("event_timestamp", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load parsed events: ${error.message}`);
    }

    const batch = data ?? [];
    for (const row of batch) {
      allRows.push({
        door: row.door,
        eventTime: row.event_time,
        eventType: row.event_type,
        timestamp: row.event_timestamp,
        csvDurationSeconds: row.csv_duration_seconds,
      });
    }

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

async function main() {
  loadEnvLocal();

  const allEvents = await loadAllParsedEvents();
  console.log(`Total parsed events in database: ${allEvents.length}`);

  const doorMatches = allEvents.filter((e) =>
    e.door.toLowerCase().includes("david clulow"),
  );
  const uniqueDoors = [...new Set(doorMatches.map((e) => e.door))];
  console.log(`\nDoor name variants matching "david clulow":`, uniqueDoors);

  const targetDoor =
    uniqueDoors.find((d) => d === DOOR_QUERY) ??
    uniqueDoors.find((d) => d.toLowerCase() === DOOR_QUERY.toLowerCase()) ??
    uniqueDoors[0];

  if (!targetDoor) {
    console.log(`\nNo events found for door matching "${DOOR_QUERY}"`);
    return;
  }

  console.log(`\nAnalyzing door: "${targetDoor}"`);

  const doorEvents = allEvents
    .filter((e) => e.door === targetDoor)
    .sort((a, b) => a.timestamp - b.timestamp);

  const dayEvents = doorEvents.filter((e) => isOnDate(e.timestamp, DATE_QUERY));
  console.log(`\nEvents on ${DATE_QUERY}: ${dayEvents.length}`);
  for (const e of dayEvents) {
    console.log(
      `  ${formatTs(e.timestamp)} | ${e.eventType} | csvDuration=${e.csvDurationSeconds ?? "null"}`,
    );
  }

  const grouped = groupEventsByDoor(doorEvents);
  const incidents = buildComplianceIncidents(
    grouped.get(targetDoor) ?? [],
    DEFAULT_ANALYTICS_CONFIG,
  );

  const dayIncidents = incidents.filter((i) => isOnDate(i.startTimestamp, DATE_QUERY));
  console.log(`\nIncidents on ${DATE_QUERY} (threshold=${DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds}s): ${dayIncidents.length}`);
  for (const i of dayIncidents) {
    console.log(
      `  ${formatTs(i.startTimestamp)} → ${formatTs(i.endTimestamp)} | duration=${i.durationSeconds}s | beyond=${i.timeBeyondThresholdSeconds}s | trigger=${i.eventType} | explicit=${i.isExplicitAlarm}`,
    );
  }

  const accumulatedIncidents = incidents.length;
  console.log(`\nTotal incidents for door (all dates): ${accumulatedIncidents}`);

  // Show open-close pairs on that day for manual verification
  console.log(`\nOpen→Close pairs spanning ${DATE_QUERY}:`);
  let openStart: (typeof doorEvents)[0] | null = null;
  for (const e of doorEvents) {
    const onDay =
      isOnDate(e.timestamp, DATE_QUERY) ||
      (openStart && isOnDate(openStart.timestamp, DATE_QUERY));
    if (!onDay && !openStart) continue;

    if (e.eventType.toLowerCase().includes("door opened") || e.eventType.toLowerCase() === "opened") {
      openStart = e;
      continue;
    }
    if (
      (e.eventType.toLowerCase().includes("door closed") || e.eventType.toLowerCase() === "closed") &&
      openStart
    ) {
      const dur = (e.timestamp - openStart.timestamp) / 1000;
      const involvesDay =
        isOnDate(openStart.timestamp, DATE_QUERY) || isOnDate(e.timestamp, DATE_QUERY);
      if (involvesDay) {
        console.log(
          `  OPEN ${formatTs(openStart.timestamp)} → CLOSE ${formatTs(e.timestamp)} = ${dur.toFixed(1)}s`,
        );
      }
      openStart = null;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
