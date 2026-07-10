import { getSupabaseAdmin } from "@/lib/server/supabase/admin";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export async function getLatestImportForAnalytics(): Promise<ServerImportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .eq("has_analytics", true)
    .in("status", ["processed", "mapped"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest server import: ${error.message}`);
  }

  if (!data) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("imports")
      .select("*")
      .not("analysis_snapshot", "is", null)
      .in("status", ["processed", "mapped"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyError) {
      throw new Error(`Failed to load latest server import: ${legacyError.message}`);
    }

    return (legacyData as ServerImportRecord | null) ?? null;
  }

  return data as ServerImportRecord;
}

export async function getLatestProcessedServerImport(): Promise<ServerImportRecord | null> {
  return getLatestImportForAnalytics();
}
