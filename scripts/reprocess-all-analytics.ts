/**
 * Reprocess all imports with analytics engine v2.
 * Usage: npx tsx scripts/reprocess-all-analytics.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANALYTICS_ENGINE_VERSION } from "../lib/analytics/analytics-engine-version";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics/config";
import { refreshAllImportAnalysisSnapshots } from "../lib/server/imports/import-service";

const thresholdArg = process.argv.find((arg) => arg.startsWith("--threshold="));
const thresholdSeconds = thresholdArg
  ? Number(thresholdArg.split("=")[1])
  : DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds;

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

  process.env.RESEND_API_KEY =
    process.env.RESEND_API_KEY?.trim() || "re_test_key";
  process.env.RESEND_WEBHOOK_SECRET =
    process.env.RESEND_WEBHOOK_SECRET?.trim() || "whsec_test_secret";
  process.env.SUPABASE_STORAGE_BUCKET =
    process.env.SUPABASE_STORAGE_BUCKET?.trim() || "imports";
  process.env.INBOUND_REPORT_EMAIL =
    process.env.INBOUND_REPORT_EMAIL?.trim() || "reports@inbound.example.com";
}

async function main() {
  loadEnvLocal();

  console.log(`Reprocessing imports with analytics engine ${ANALYTICS_ENGINE_VERSION}...`);

  const result = await refreshAllImportAnalysisSnapshots({
    heldOpenThresholdSeconds: thresholdSeconds,
  });

  console.log(
    `Done. Refreshed=${result.refreshed}, skipped=${result.skipped}, engine=${ANALYTICS_ENGINE_VERSION}, threshold=${thresholdSeconds}s`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
