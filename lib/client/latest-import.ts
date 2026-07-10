"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLatestImport,
  getLatestImportData,
} from "@/lib/imports/storage";
import type { CsvRow, ImportAnalysisSnapshot, ImportRecord } from "@/lib/imports/types";

export type LatestImportSource = "local" | "server";

export type LoadedLatestImport = {
  record: ImportRecord;
  rows: CsvRow[];
  source: LatestImportSource;
};

type ServerLatestImportResponse = {
  configured: boolean;
  import: {
    id: string;
    fileName: string;
    rowCount: number;
    columnCount: number;
    headers: string[];
    status: ImportRecord["status"];
    uploadedAt: string;
    source: "manual_upload" | "inbound_email";
    analysisSnapshot: ImportAnalysisSnapshot;
  } | null;
};

function mapServerImport(
  serverImport: NonNullable<ServerLatestImportResponse["import"]>,
): ImportRecord {
  return {
    id: serverImport.id,
    fileName: serverImport.fileName,
    rowCount: serverImport.rowCount,
    columnCount: serverImport.columnCount,
    headers: serverImport.headers,
    status: serverImport.status,
    uploadedAt: serverImport.uploadedAt,
    previewRows: [],
    analysisSnapshot: serverImport.analysisSnapshot,
  };
}

function pickLatestImport(
  local: ImportRecord | null,
  server: ImportRecord | null,
): { record: ImportRecord | null; source: LatestImportSource | null } {
  if (!local && !server) {
    return { record: null, source: null };
  }

  if (!local) {
    return { record: server, source: "server" };
  }

  if (!server) {
    return { record: local, source: "local" };
  }

  const localTime = Date.parse(local.uploadedAt);
  const serverTime = Date.parse(server.uploadedAt);

  if (serverTime >= localTime) {
    return { record: server, source: "server" };
  }

  return { record: local, source: "local" };
}

export async function loadLatestImport(): Promise<LoadedLatestImport | null> {
  const local = getLatestImport();
  let serverRecord: ImportRecord | null = null;

  try {
    const response = await fetch("/api/imports/latest");
    if (response.ok) {
      const payload = (await response.json()) as ServerLatestImportResponse;
      if (payload.import) {
        serverRecord = mapServerImport(payload.import);
      }
    }
  } catch {
    // Fall back to browser imports when the server import API is unavailable.
  }

  const selected = pickLatestImport(local, serverRecord);
  if (!selected.record || !selected.source) {
    return null;
  }

  const rows =
    selected.source === "local" ? getLatestImportData() : [];

  return {
    record: selected.record,
    rows,
    source: selected.source,
  };
}

export function useLatestImport() {
  const [loadedImport, setLoadedImport] = useState<LoadedLatestImport | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const latest = await loadLatestImport();
    setLoadedImport(latest);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loadedImport, loaded, reload };
}
