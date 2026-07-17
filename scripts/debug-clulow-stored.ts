import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DOOR = "Ground - Adj David Clulow";

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
  const { data } = await sb
    .from("import_incidents")
    .select("import_id, end_time_label, analytics_engine_version")
    .eq("door", DOOR);

  console.log("rows", data?.length);
  for (const row of data ?? []) {
    console.log(row.import_id.slice(0, 8), row.end_time_label, row.analytics_engine_version);
  }
}

main().catch(console.error);
