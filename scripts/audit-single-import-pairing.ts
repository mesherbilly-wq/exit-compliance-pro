import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { pairDoorOpenCloseSessions } from "../lib/analytics/door-open-close-pairing";
import { buildComplianceIncidents } from "../lib/analytics/compliance-incidents";
import { buildCanonicalIncidentsByDoor } from "../lib/analytics/canonical-incident-engine";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

const CLULOW = "Ground - Adj David Clulow";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: imp } = await sb.from("imports").select("*").order("created_at", { ascending: false }).limit(1).single();
  if (!imp) return console.log("No imports");

  const { data: events } = await sb.from("import_parsed_events").select("*").eq("import_id", imp.id).eq("door", CLULOW).order("event_timestamp");
  const parsed: ParsedFireExitEvent[] = (events ?? []).map((e) => ({
    door: e.door, eventTime: e.event_time, eventType: e.event_type, timestamp: e.event_timestamp,
    csvDurationSeconds: e.csv_duration_seconds, sourceImportId: imp.id,
    sourceRowNumber: e.source_row_number ?? undefined, sourceSequence: e.source_sequence ?? undefined,
  }));

  console.log("Import:", imp.file_name, "| rows:", imp.row_count, "| Clulow events:", parsed.length);
  console.log("Date range:", parsed[0]?.eventTime, "→", parsed.at(-1)?.eventTime);

  const pairing = pairDoorOpenCloseSessions(parsed);
  const over300 = pairing.sessions.filter((s) => s.durationSeconds > 300);
  console.log("\nFlat pairing (all Clulow in one file):");
  console.log(`  Sessions: ${pairing.sessions.length}, >300s: ${over300.length}, orphans: ${pairing.orphanCloses.length}, pending: ${pairing.pendingOpen ? 1 : 0}`);
  for (const s of over300) {
    console.log(`  ${s.openEvent.eventTime} → ${s.closeEvent.eventTime} = ${s.durationSeconds}s`);
  }

  const flatIncidents = buildComplianceIncidents(parsed, { heldOpenThresholdSeconds: 300 });
  console.log(`\nbuildComplianceIncidents (flat): ${flatIncidents.length} incidents`);

  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId: new Map([[imp.id, parsed]]),
    importContexts: new Map([[imp.id, { importId: imp.id, reportingPeriodStart: imp.reporting_period_start, reportingPeriodEnd: imp.reporting_period_end, createdAt: imp.created_at }]]),
    config: { heldOpenThresholdSeconds: 300 },
    includeTrace: true,
  });
  console.log(`\nCanonical (single import): ${canonical.incidentsByDoor.get(CLULOW)?.length ?? 0} incidents`);
  for (const inc of canonical.incidentsByDoor.get(CLULOW) ?? []) {
    console.log(`  ${inc.startTimeLabel} → ${inc.endTimeLabel} (${inc.durationSeconds}s)`);
  }

  // Check for held-open native events
  const held = parsed.filter((e) => /held|too long/i.test(e.eventType));
  console.log(`\nNative held-open event types: ${held.length}`);

  // Event type breakdown
  const types: Record<string, number> = {};
  for (const e of parsed) types[e.eventType] = (types[e.eventType] ?? 0) + 1;
  console.log("Event types:", types);
}

main().catch(console.error);
