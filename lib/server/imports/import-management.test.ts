import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { processCsvImport } from "@/lib/server/imports/process-csv-import";
import { ImportProcessingLogger, sourceToLabel } from "@/lib/server/types/import-management";

const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("ImportProcessingLogger", () => {
  it("tracks info, warn, and error entries", () => {
    const logger = new ImportProcessingLogger();
    logger.info("Started");
    logger.warn("Mapping incomplete");
    logger.error("Parse failed");

    expect(logger.getEntries()).toHaveLength(3);
    expect(logger.getErrorCount()).toBe(1);
  });
});

describe("sourceToLabel", () => {
  it("maps import sources to display labels", () => {
    expect(sourceToLabel("inbound_email")).toBe("Email");
    expect(sourceToLabel("manual_upload")).toBe("Manual");
  });
});

describe("processCsvImport analytics metadata", () => {
  it("derives door and incident counts from intelligence report", () => {
    const result = processCsvImport({
      fileName: "genetec-headered.csv",
      csvText: readFixture("genetec-headered.csv"),
      source: "manual_upload",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysisSnapshot.intelligence.summary.totalDoors).toBeGreaterThan(0);
      expect(result.analysisSnapshot.parsedEvents?.length).toBe(result.rowCount);
    }
  });
});
