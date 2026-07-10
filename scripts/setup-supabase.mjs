/**
 * One-time Supabase setup: create storage bucket and verify tables.
 * Usage: node scripts/setup-supabase.mjs
 * Requires .env.local with SUPABASE_* vars.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) {
    throw new Error(".env.local not found");
  }

  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "inbound-csv";

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`listBuckets: ${listError.message}`);
  }

  const exists = buckets?.some((b) => b.name === bucket || b.id === bucket);
  if (exists) {
    console.log(`Storage bucket "${bucket}" already exists.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["text/csv", "application/csv", "text/plain"],
  });

  if (createError) {
    throw new Error(`createBucket: ${createError.message}`);
  }

  console.log(`Created storage bucket "${bucket}".`);
}

async function verifyTables() {
  const checks = ["inbound_emails", "imports"];
  const missing = [];

  for (const table of checks) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      missing.push(table);
    } else if (error) {
      console.warn(`Warning checking ${table}: ${error.message}`);
    } else {
      console.log(`Table "${table}" is ready.`);
    }
  }

  if (missing.length > 0) {
    console.log("\nMissing tables:", missing.join(", "));
    console.log("Apply migrations via Supabase SQL Editor:");
    console.log("  supabase/migrations/001_inbound_email.sql");
    console.log("  supabase/migrations/002_storage_bucket.sql");
    console.log("\nOr run: supabase link --project-ref vqdptnbuhfbkttaazarw && supabase db push");
    return false;
  }

  return true;
}

try {
  await ensureBucket();
  const tablesOk = await verifyTables();
  console.log(tablesOk ? "\nSupabase setup complete." : "\nBucket ready; apply SQL migrations next.");
} catch (err) {
  console.error("Setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
