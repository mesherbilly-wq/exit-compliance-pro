import type { FieldMapping, ImportRecord } from "./types";

const STORAGE_KEY = "exit-compliance-pro:recent-imports";
const MAPPING_STORAGE_KEY = "exit-compliance-pro:field-mappings";
const IMPORT_DATA_KEY = "exit-compliance-pro:import-data";

type StoredMappings = Record<string, FieldMapping>;
type StoredImportData = Record<string, Record<string, string>[]>;

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

export function getLatestImport(): ImportRecord | null {
  const imports = getRecentImports();
  return imports[0] ?? null;
}

export function saveImport(record: ImportRecord): ImportRecord[] {
  const existing = getRecentImports();
  const updated = [record, ...existing.filter((item) => item.id !== record.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateImportStatus(
  importId: string,
  status: ImportRecord["status"],
): void {
  const imports = getRecentImports().map((item) =>
    item.id === importId ? { ...item, status } : item,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(imports));
}

export function saveImportData(
  importId: string,
  rows: Record<string, string>[],
): void {
  const existing = getStoredImportData();
  existing[importId] = rows;
  localStorage.setItem(IMPORT_DATA_KEY, JSON.stringify(existing));
}

export function getImportData(importId: string): Record<string, string>[] {
  return getStoredImportData()[importId] ?? [];
}

export function getLatestImportData(): Record<string, string>[] {
  const latest = getLatestImport();
  return latest ? getImportData(latest.id) : [];
}

function getStoredImportData(): StoredImportData {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(IMPORT_DATA_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredImportData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getFieldMapping(importId: string): FieldMapping | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredMappings;
    return parsed[importId] ?? null;
  } catch {
    return null;
  }
}

export function saveFieldMapping(
  importId: string,
  mapping: FieldMapping,
): void {
  const existing = getStoredMappings();
  existing[importId] = mapping;
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(existing));
}

function getStoredMappings(): StoredMappings {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredMappings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
