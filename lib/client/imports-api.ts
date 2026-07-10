import type {
  FieldMapping,
  ImportAnalysisSnapshot,
  ImportStatus,
} from "@/lib/imports/types";
import { getAnalyticsConfig } from "@/lib/analytics/config";
import type { ServerImportListItem } from "@/lib/server/types/inbound-email";
import type { ProcessingLogEntry } from "@/lib/server/types/import-management";
import {
  mapServerImportListItem,
  type ApiImportRecord,
} from "@/lib/client/import-types";

export type { ApiImportRecord };

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

export async function fetchImportById(importId: string): Promise<ApiImportRecord> {
  const response = await fetch(`/api/imports/${importId}`);
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load import.");
  }

  const payload = (await response.json()) as {
    import: ApiImportRecord & { analysisSnapshot?: ImportAnalysisSnapshot };
  };

  return payload.import;
}

export async function fetchImportProcessingLog(importId: string): Promise<{
  importId: string;
  processingLog: ProcessingLogEntry[];
  errorCount: number;
}> {
  const response = await fetch(`/api/imports/${importId}/log`);
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load processing log.");
  }

  return (await response.json()) as {
    importId: string;
    processingLog: ProcessingLogEntry[];
    errorCount: number;
  };
}

export async function reprocessImportById(importId: string): Promise<ApiImportRecord> {
  const response = await fetch(`/api/imports/${importId}/reprocess`, {
    method: "POST",
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Reprocess failed.");
  }

  const payload = (await response.json()) as {
    import: Partial<ApiImportRecord> & { id: string };
  };

  const existing = await fetchImportById(importId);
  return { ...existing, ...payload.import };
}

export async function downloadFailedImportCsv(importId: string): Promise<void> {
  const response = await fetch(`/api/imports/${importId}/download`);
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Download failed.");
  }

  const blob = await response.blob();
  const importRecord = await fetchImportById(importId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = importRecord.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
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

  const payload = (await response.json()) as { import: ApiImportRecord };
  return payload.import;
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
  const config = getAnalyticsConfig();
  const response = await fetch(
    `/api/imports/latest?heldOpenThresholdSeconds=${config.heldOpenThresholdSeconds}`,
  );
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    import: ApiImportRecord | null;
  };

  return payload.import ?? null;
}

export function getImportStats(imports: ApiImportRecord[]) {
  return {
    total: imports.length,
    readyForMapping: imports.filter((item) => item.status === "ready_for_mapping")
      .length,
    mapped: imports.filter((item) => item.status === "mapped").length,
    processed: imports.filter((item) => item.status === "processed").length,
    failed: imports.filter((item) => item.status === "failed").length,
  };
}

function formatReportingPeriod(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) {
    return "—";
  }

  const startLabel = start ? new Date(start).toLocaleDateString() : "?";
  const endLabel = end ? new Date(end).toLocaleDateString() : "?";
  return `${startLabel} – ${endLabel}`;
}

export function formatProcessingDuration(ms: number | null): string {
  if (ms === null || ms === undefined) {
    return "—";
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

export { formatReportingPeriod };
