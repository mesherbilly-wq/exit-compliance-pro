import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { processCsvImport } from "@/lib/server/imports/process-csv-import";
import * as importAnalysis from "@/lib/imports/import-analysis";

const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("processCsvImport", () => {
  it("processes a valid CSV attachment", () => {
    const result = processCsvImport({
      fileName: "genetec-headered.csv",
      csvText: readFixture("genetec-headered.csv"),
      source: "inbound_email",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rowCount).toBe(3);
      expect(result.status).toBe("processed");
      expect(result.analysisSnapshot.intelligence).toBeDefined();
    }
  });

  it("processes a headerless Genetec CSV", () => {
    const result = processCsvImport({
      fileName: "genetec-headerless.csv",
      csvText: readFixture("genetec-headerless.csv"),
      source: "inbound_email",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.headers).toContain("Event Type");
    }
  });

  it("returns a parse failure for invalid CSV content", () => {
    const result = processCsvImport({
      fileName: "broken.csv",
      csvText: '"unclosed quote\nvalue',
      source: "inbound_email",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("failed");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns an analytics failure when analysis throws", () => {
    vi.spyOn(importAnalysis, "buildImportAnalysis").mockImplementation(() => {
      throw new Error("Analytics engine failure.");
    });

    const result = processCsvImport({
      fileName: "genetec-headered.csv",
      csvText: readFixture("genetec-headered.csv"),
      source: "inbound_email",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("Analytics engine failure.");
    }
  });
});
