import {
  PREVIEW_ROW_LIMIT,
  STORAGE_QUOTA_MESSAGE,
  type CsvRow,
  type FieldMapping,
  type ImportAnalysisSnapshot,
  type ImportRecord,
} from "./types";
import {
  fixHeaderlessCsvParse,
  looksLikeHeaderlessExport,
} from "./resolve-mapping";
import {
  buildImportAnalysis,
  isFullImportAnalysis,
} from "./import-analysis";

const STORAGE_KEY = "exit-compliance-pro:recent-imports";
const MAPPING_STORAGE_KEY = "exit-compliance-pro:field-mappings";
const LEGACY_IMPORT_DATA_KEY = "exit-compliance-pro:import-data";

type StoredMappings = Record<string, FieldMapping>;
type LegacyStoredImportData = Record<string, CsvRow[]>;

export class StorageError extends Error {
  readonly code: "QUOTA_EXCEEDED" | "UNKNOWN";

  constructor(message: string, code: "QUOTA_EXCEEDED" | "UNKNOWN" = "UNKNOWN") {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.code === 22 ||
      error.code === 1014)
  );
}

function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new StorageError(STORAGE_QUOTA_MESSAGE, "QUOTA_EXCEEDED");
    }

    throw new StorageError("Failed to save data to browser storage.");
  }
}

function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function previewRowsMatchHeaders(record: ImportRecord): boolean {
  const firstRow = record.previewRows[0];
  if (!firstRow || record.headers.length === 0) {
    return true;
  }

  return record.headers.every((header) => header in firstRow);
}

function repairPreviewRowKeys(record: ImportRecord): ImportRecord {
  if (previewRowsMatchHeaders(record) || record.previewRows.length === 0) {
    return record;
  }

  const repairedRows = record.previewRows.map((row) => {
    const values = Object.values(row).map((value) => String(value ?? "").trim());
    const repaired: CsvRow = {};

    record.headers.forEach((header, index) => {
      repaired[header] = values[index] ?? "";
    });

    return repaired;
  });

  return {
    ...record,
    previewRows: repairedRows,
  };
}

function ensureAnalysisSnapshot(record: ImportRecord): ImportRecord {
  if (isFullImportAnalysis(record)) {
    return record;
  }

  if (record.previewRows.length === 0) {
    return record;
  }

  try {
    const savedMapping =
      record.analysisSnapshot?.mapping ?? getFieldMapping(record.id);

    const snapshot = buildImportAnalysis(
      record.headers,
      record.previewRows,
      record.fileName,
      savedMapping,
    );

    return {
      ...record,
      analysisSnapshot: snapshot,
    };
  } catch {
    return record;
  }
}

function normalizeImportRecord(record: ImportRecord): ImportRecord {
  let normalized: ImportRecord = {
    ...record,
    previewRows: Array.isArray(record.previewRows) ? record.previewRows : [],
  };

  if (looksLikeHeaderlessExport(normalized.headers)) {
    const fixed = fixHeaderlessCsvParse(
      normalized.headers,
      normalized.previewRows,
    );

    normalized = {
      ...normalized,
      headers: fixed.headers,
      previewRows: fixed.rows.slice(0, PREVIEW_ROW_LIMIT),
    };
  }

  normalized = repairPreviewRowKeys(normalized);
  normalized = ensureAnalysisSnapshot(normalized);

  return normalized;
}

function getLegacyImportData(): LegacyStoredImportData {
  try {
    const raw = getStorageItem(LEGACY_IMPORT_DATA_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as LegacyStoredImportData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function migrateLegacyImportData(imports: ImportRecord[]): ImportRecord[] {
  const legacyData = getLegacyImportData();
  const hasLegacyData = Object.keys(legacyData).length > 0;
  const hasMissingPreview = imports.some(
    (item) => !item.previewRows || item.previewRows.length === 0,
  );

  if (!hasLegacyData && !hasMissingPreview) {
    return imports;
  }

  const migrated = imports.map((item) => {
    if (item.previewRows?.length) {
      return normalizeImportRecord(item);
    }

    const legacyRows = legacyData[item.id];
    return normalizeImportRecord({
      ...item,
      previewRows: legacyRows ? legacyRows.slice(0, PREVIEW_ROW_LIMIT) : [],
    });
  });

  try {
    setStorageItem(STORAGE_KEY, JSON.stringify(migrated));

    if (hasLegacyData) {
      localStorage.removeItem(LEGACY_IMPORT_DATA_KEY);
    }
  } catch {
    return migrated;
  }

  return migrated;
}

export function getRecentImports(): ImportRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ImportRecord[];
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed.map(normalizeImportRecord);
    const migrated = migrateLegacyImportData(normalized);
    const needsRepair = parsed.some(
      (record, index) =>
        JSON.stringify(record) !== JSON.stringify(migrated[index]),
    );

    if (needsRepair) {
      try {
        setStorageItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        return migrated;
      }
    }

    return migrated;
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
  const normalized = normalizeImportRecord(record);
  const updated = [
    normalized,
    ...existing.filter((item) => item.id !== normalized.id),
  ];
  setStorageItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateImportStatus(
  importId: string,
  status: ImportRecord["status"],
): void {
  const imports = getRecentImports().map((item) =>
    item.id === importId ? { ...item, status } : item,
  );
  setStorageItem(STORAGE_KEY, JSON.stringify(imports));
}

export function saveImportData(importId: string, rows: CsvRow[]): void {
  const previewRows = rows.slice(0, PREVIEW_ROW_LIMIT);
  const imports = getRecentImports();
  const importRecord = imports.find((item) => item.id === importId);

  if (!importRecord) {
    throw new StorageError("Import record not found.");
  }

  const snapshot = buildImportAnalysis(
    importRecord.headers,
    rows,
    importRecord.fileName,
    getFieldMapping(importId),
  );

  saveFieldMapping(importId, snapshot.mapping);

  const updated = imports.map((item) =>
    item.id === importId
      ? {
          ...item,
          previewRows,
          analysisSnapshot: snapshot,
          status: "mapped" as const,
        }
      : item,
  );

  setStorageItem(STORAGE_KEY, JSON.stringify(updated));
}

export function saveImportAnalysisSnapshot(
  importId: string,
  snapshot: ImportAnalysisSnapshot,
): void {
  saveFieldMapping(importId, snapshot.mapping);

  const imports = getRecentImports().map((item) =>
    item.id === importId ? { ...item, analysisSnapshot: snapshot } : item,
  );

  setStorageItem(STORAGE_KEY, JSON.stringify(imports));
}

export function getImportData(importId: string): CsvRow[] {
  const importRecord = getRecentImports().find((item) => item.id === importId);
  return importRecord?.previewRows ?? [];
}

export function getLatestImportData(): CsvRow[] {
  const latest = getLatestImport();
  return latest?.previewRows ?? [];
}

export function getFieldMapping(importId: string): FieldMapping | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = getStorageItem(MAPPING_STORAGE_KEY);
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
  setStorageItem(MAPPING_STORAGE_KEY, JSON.stringify(existing));
}

export function deleteImport(importId: string): ImportRecord[] {
  const updated = getRecentImports().filter((item) => item.id !== importId);
  setStorageItem(STORAGE_KEY, JSON.stringify(updated));

  const mappings = getStoredMappings();
  if (mappings[importId]) {
    delete mappings[importId];
    setStorageItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings));
  }

  return updated;
}

function getStoredMappings(): StoredMappings {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = getStorageItem(MAPPING_STORAGE_KEY);
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
