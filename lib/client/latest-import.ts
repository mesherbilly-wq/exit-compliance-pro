"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLatestImport,
  type ApiImportRecord,
} from "@/lib/client/imports-api";
import type { CsvRow } from "@/lib/imports/types";

export type LoadedLatestImport = {
  record: ApiImportRecord;
  rows: CsvRow[];
};

export async function loadLatestImport(): Promise<LoadedLatestImport | null> {
  const record = await fetchLatestImport();
  if (!record) {
    return null;
  }

  return {
    record,
    rows: [],
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
