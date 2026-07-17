/**
 * Trace a specific incident back to exact source rows.
 * Usage: npx tsx scripts/trace-incident-source-rows.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { buildCanonicalIncidentsByDoor } from "../lib/analytics/canonical-incident-engine";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics/config";
import type { ParsedFireExitEvent } from "../lib/analytics/types";

const DOOR = "Ground - Adj David Clulow";
const INCIDENT_END_LABEL = "7/17/2026 5:37:35 AM";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
}

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: stored } = await sb
    .from("import_incidents")
    .select("*")
    .eq("door", DOOR)
    .eq("end_time_label", INCIDENT_END_LABEL);

  console.log("=== STORED INCIDENT ===");
  console.log(JSON.stringify(stored, null, 2));

  const { data: imports } = await sb
    .from("imports")
    .select(
      "id, file_name, created_at, reporting_period_start, reporting_period_end, analytics_threshold_seconds",
    )
    .order("created_at", { ascending: true });

  const importById = new Map((imports ?? []).map((row) => [row.id, row]));
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

    const { data: events } = await sb
      .from("import_parsed_events")
      .select("*")
      .eq("import_id", row.id)
      .eq("door", DOOR)
      .order("event_timestamp", { ascending: true });

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
      })),
    );
  }

  const threshold =
    imports?.find((row) => row.analytics_threshold_seconds != null)
      ?.analytics_threshold_seconds ?? 300;

  const canonical = buildCanonicalIncidentsByDoor({
    eventsByImportId,
    importContexts,
    config: { heldOpenThresholdSeconds: threshold },
    includeTrace: true,
  });

  const incident = (canonical.incidentsByDoor.get(DOOR) ?? []).find(
    (row) => row.endTimeLabel === INCIDENT_END_LABEL,
  );

  console.log("\n=== CANONICAL INCIDENT (live recalc) ===");
  console.log(JSON.stringify(incident, null, 2));

  if (!incident?.trace) {
    console.log("No trace available.");
    return;
  }

  const trace = incident.trace;
  const openImport = importById.get(trace.openSourceImportId ?? "");
  const closeImport = importById.get(trace.closeSourceImportId ?? "");

  console.log("\n=== SOURCE IMPORTS ===");
  console.log("Open import:", openImport?.file_name, trace.openSourceImportId);
  console.log("Close import:", closeImport?.file_name, trace.closeSourceImportId);

  async function fetchEventRow(importId: string | null, rowNumber: number | null) {
    if (!importId || rowNumber == null) return null;
    const { data } = await sb
      .from("import_parsed_events")
      .select("*")
      .eq("import_id", importId)
      .eq("source_row_number", rowNumber)
      .eq("door", DOOR)
      .maybeSingle();
    return data;
  }

  const openRow = await fetchEventRow(
    trace.openSourceImportId,
    trace.openSourceRowNumber,
  );
  const closeRow = await fetchEventRow(
    trace.closeSourceImportId,
    trace.closeSourceRowNumber,
  );

  console.log("\n=== OPEN SOURCE ROW (DB) ===");
  console.log(JSON.stringify(openRow, null, 2));
  console.log("\n=== CLOSE SOURCE ROW (DB) ===");
  console.log(JSON.stringify(closeRow, null, 2));

  // Also find by timestamp in case row numbers missing
  const jul17Events = [...eventsByImportId.values()]
    .flat()
    .filter((event) => event.eventTime.includes("7/17/2026") || event.eventTime.includes("17/07/2026"))
    .sort((a, b) => a.timestamp - b.timestamp);

  console.log("\n=== ALL CLULOW EVENTS ON 17/07/2026 (parsed) ===");
  for (const event of jul17Events) {
    const imp = importById.get(event.sourceImportId ?? "");
    console.log(
      [
        imp?.file_name ?? "?",
        `row=${event.sourceRowNumber ?? "?"}`,
        `seq=${event.sourceSequence ?? "?"}`,
        event.eventType,
        event.eventTime,
        `ts=${event.timestamp}`,
      ].join(" | "),
    );
  }

  if (openRow && closeRow) {
    const calcDuration = (closeRow.event_timestamp - openRow.event_timestamp) / 1000;
    console.log("\n=== CALCULATED DURATION (from DB timestamps) ===");
    console.log(`${calcDuration}s (incident reports ${incident.durationSeconds}s open duration)`);
    console.log(
      `Time beyond threshold: ${Math.max(0, calcDuration - threshold)}s at ${threshold}s threshold`,
    );
  }

  // Match by incident timestamps when row numbers unavailable
  const openTs = incident.endTimestamp - incident.durationSeconds * 1000;
  const closeTs = incident.endTimestamp;
  const matchingOpen = [...eventsByImportId.values()]
    .flat()
    .find(
      (event) =>
        event.eventType === "Door opened" &&
        event.timestamp === openTs &&
        event.door === DOOR,
    );
  const matchingClose = [...eventsByImportId.values()]
    .flat()
    .find(
      (event) =>
        event.eventType === "Door closed" &&
        event.timestamp === closeTs &&
        event.door === DOOR,
    );

  console.log("\n=== MATCHED OPEN/CLOSE BY TIMESTAMP ===");
  console.log("Open:", JSON.stringify(matchingOpen, null, 2));
  console.log("Close:", JSON.stringify(matchingClose, null, 2));

  if (matchingOpen && matchingClose) {
    const openImportFile = importById.get(matchingOpen.sourceImportId ?? "")?.file_name;
    const calc = (matchingClose.timestamp - matchingOpen.timestamp) / 1000;
    console.log("\n=== EVIDENCE SUMMARY ===");
    console.log(`CSV file: ${openImportFile}`);
    console.log(`Open event: ${matchingOpen.eventType} | ${matchingOpen.eventTime} | ts=${matchingOpen.timestamp}`);
    console.log(`Close event: ${matchingClose.eventType} | ${matchingClose.eventTime} | ts=${matchingClose.timestamp}`);
    console.log(`Calculated duration: ${calc}s`);
    console.log(`Incident displayed start (threshold crossed): ${incident.startTimeLabel}`);
    console.log(`Incident displayed end: ${incident.endTimeLabel}`);
  }

  // Try raw CSV lines from storage
  try {
    process.env.RESEND_WEBHOOK_SECRET =
      process.env.RESEND_WEBHOOK_SECRET?.trim() || "whsec_test_secret";
    process.env.RESEND_API_KEY =
      process.env.RESEND_API_KEY?.trim() || "re_test_key";
    process.env.SUPABASE_STORAGE_BUCKET =
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || "imports";
    process.env.INBOUND_REPORT_EMAIL =
      process.env.INBOUND_REPORT_EMAIL?.trim() || "reports@example.com";

    const { downloadCsvFromStorage } = await import(
      "../lib/server/db/inbound-email-repository"
    );
    const importId = trace.closeSourceImportId ?? trace.openSourceImportId;
    const importRecord = importById.get(importId ?? "");
    const { data: importRow } = await sb
      .from("imports")
      .select("original_file_path, failed_csv_path")
      .eq("id", importId ?? "")
      .single();

    const storagePath =
      importRow?.original_file_path ?? importRow?.failed_csv_path ?? null;

    if (storagePath) {
      const csvText = await downloadCsvFromStorage(
        storagePath,
        process.env.SUPABASE_STORAGE_BUCKET!,
      );
      const lines = csvText.split(/\r?\n/);
      console.log("\n=== RAW CSV ROWS (matching Clulow + 5:26/5:37 times) ===");
      lines.forEach((line, index) => {
        if (
          line.includes("Clulow") &&
          (line.includes("5:26") ||
            line.includes("5:37") ||
            line.includes("05:26") ||
            line.includes("05:37"))
        ) {
          console.log(`Row ${index + 1}: ${line}`);
        }
      });
    } else {
      console.log("\nNo CSV in storage (original_file_path null after reprocess).");
    }
  } catch (error) {
    console.log("\nCould not load raw CSV:", error);
  }
}

main().catch(console.error);
