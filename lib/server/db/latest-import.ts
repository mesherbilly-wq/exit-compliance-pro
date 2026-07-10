import { getSupabaseAdmin } from "@/lib/server/supabase/admin";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export async function getLatestImportForAnalytics(): Promise<ServerImportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .not("analysis_snapshot", "is", null)
    .in("status", ["processed", "mapped"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest server import: ${error.message}`);
  }

  return (data as ServerImportRecord | null) ?? null;
}

export async function getLatestProcessedServerImport(): Promise<ServerImportRecord | null> {
  return getLatestImportForAnalytics();
}
