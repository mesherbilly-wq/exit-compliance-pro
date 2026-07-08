import type { ImportRecord } from "./types";

const STORAGE_KEY = "exit-compliance-pro:recent-imports";

export function getRecentImports(): ImportRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ImportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImport(record: ImportRecord): ImportRecord[] {
  const existing = getRecentImports();
  const updated = [record, ...existing.filter((item) => item.id !== record.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function getImportStats(imports: ImportRecord[]) {
  return {
    total: imports.length,
    readyForMapping: imports.filter((item) => item.status === "ready_for_mapping")
      .length,
    mapped: imports.filter((item) => item.status === "mapped").length,
    processed: imports.filter((item) => item.status === "processed").length,
  };
}
