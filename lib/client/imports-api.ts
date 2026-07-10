import type {
  FieldMapping,
  ImportAnalysisSnapshot,
  ImportRecord,
  ImportStatus,
} from "@/lib/imports/types";
import type {
  ServerImportListItem,
  ServerImportSource,
} from "@/lib/server/types/inbound-email";

export type ApiImportRecord = ImportRecord & {
  source: ServerImportSource;
  sender: string | null;
  emailSubject: string | null;
  processingResult: string | null;
};

type ApiImportPayload = {
  id: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  status: ImportStatus;
  uploadedAt: string;
  source: ServerImportSource;
  analysisSnapshot?: ImportAnalysisSnapshot;
  processingResult?: string | null;
  sender?: string | null;
  emailSubject?: string | null;
};

function mapApiImport(payload: ApiImportPayload): ApiImportRecord {
  return {
    id: payload.id,
    fileName: payload.fileName,
    rowCount: payload.rowCount,
    columnCount: payload.columnCount,
    headers: payload.headers,
    status: payload.status,
    uploadedAt: payload.uploadedAt,
    previewRows: [],
    analysisSnapshot: payload.analysisSnapshot,
    source: payload.source,
    sender: payload.sender ?? null,
    emailSubject: payload.emailSubject ?? null,
    processingResult: payload.processingResult ?? null,
  };
}

export function mapServerImportListItem(item: ServerImportListItem): ApiImportRecord {
  return {
    id: item.id,
    fileName: item.fileName,
    rowCount: item.rowCount,
    columnCount: item.columnCount,
    headers: item.headers,
    status: item.status as ImportStatus,
    uploadedAt: item.receivedAt ?? item.createdAt,
    previewRows: [],
    source: item.source,
    sender: item.sender,
    emailSubject: item.emailSubject,
    processingResult: item.processingResult,
  };
}

export async function fetchImports(): Promise<ApiImportRecord[]> {
  const response = await fetch("/api/imports");
  if (!response.ok) {
    throw new Error("Failed to load imports.");
  }

  const payload = (await response.json()) as {
    configured: boolean;
    imports: ServerImportListItem[];
  };

  return (payload.imports ?? []).map(mapServerImportListItem);
}

export async function uploadManualImport(file: File): Promise<ApiImportRecord> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/imports/manual", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Upload failed.");
  }

  const payload = (await response.json()) as { import: ApiImportPayload };
  return mapApiImport(payload.import);
}

export async function deleteImportById(importId: string): Promise<void> {
  const response = await fetch(`/api/imports/${importId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Delete failed.");
  }
}

export async function updateImportMappingApi(
  importId: string,
  mapping: FieldMapping,
): Promise<void> {
  const response = await fetch(`/api/imports/${importId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapping }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to update mapping.");
  }
}

export async function saveImportSnapshot(
  importId: string,
  analysisSnapshot: ImportAnalysisSnapshot,
  status?: ImportStatus,
): Promise<void> {
  const response = await fetch(`/api/imports/${importId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisSnapshot, status }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to save import analysis.");
  }
}

export async function refreshImportAnalysis(config: {
  heldOpenThresholdSeconds: number;
}): Promise<{ refreshed: number; skipped: number }> {
  const response = await fetch("/api/imports/refresh-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to refresh import analysis.");
  }

  return (await response.json()) as { refreshed: number; skipped: number };
}

export async function fetchLatestImport(): Promise<ApiImportRecord | null> {
  const response = await fetch("/api/imports/latest");
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    import: ApiImportPayload | null;
  };

  return payload.import ? mapApiImport(payload.import) : null;
}

export function getImportStats(imports: ApiImportRecord[]) {
  return {
    total: imports.length,
    readyForMapping: imports.filter((item) => item.status === "ready_for_mapping")
      .length,
    mapped: imports.filter((item) => item.status === "mapped").length,
    processed: imports.filter((item) => item.status === "processed").length,
  };
}
