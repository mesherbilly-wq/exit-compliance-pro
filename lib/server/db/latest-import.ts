import { getSupabaseAdmin } from "@/lib/server/supabase/admin";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export async function getLatestProcessedServerImport(): Promise<ServerImportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .eq("status", "processed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest server import: ${error.message}`);
  }

  return (data as ServerImportRecord | null) ?? null;
}
