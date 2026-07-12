import { listImportsWithAnalytics } from "@/lib/server/db/inbound-email-repository";
import type { ServerImportRecord } from "@/lib/server/types/inbound-email";

export async function listImportsForAnalytics(): Promise<ServerImportRecord[]> {
  const records = await listImportsWithAnalytics();
  return [...records].reverse();
}

export async function getLatestImportForAnalytics(): Promise<ServerImportRecord | null> {
  const imports = await listImportsForAnalytics();
  return imports.at(-1) ?? null;
}

export async function getLatestProcessedServerImport(): Promise<ServerImportRecord | null> {
  return getLatestImportForAnalytics();
}
