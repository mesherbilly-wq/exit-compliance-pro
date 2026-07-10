import type { ImportRecord } from "./types";

export function getImportStats(imports: ImportRecord[]) {
  return {
    total: imports.length,
    readyForMapping: imports.filter((item) => item.status === "ready_for_mapping")
      .length,
    mapped: imports.filter((item) => item.status === "mapped").length,
    processed: imports.filter((item) => item.status === "processed").length,
  };
}

export class StorageError extends Error {
  readonly code: "QUOTA_EXCEEDED" | "UNKNOWN";

  constructor(message: string, code: "QUOTA_EXCEEDED" | "UNKNOWN" = "UNKNOWN") {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}
