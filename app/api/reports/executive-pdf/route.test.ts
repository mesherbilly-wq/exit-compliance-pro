import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reports/executive-pdf/route";
import * as buildExport from "@/lib/server/reports/build-executive-report-for-export";
import * as renderPdf from "@/lib/server/reports/render-executive-report-pdf";
import { buildExecutiveReport } from "@/lib/analytics/executive-report";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import type { FieldMapping } from "@/lib/imports/types";

const mapping: FieldMapping = {
  eventTime: "Event timestamp",
  eventType: "Event",
  doorName: "Door",
  cardholderName: "",
  cardholderEmail: "",
  credentialNumber: "",
  accessResult: "",
  siteBuilding: "",
};

function sampleReport() {
  const events = [
    {
      door: "Door A",
      eventType: "Door opened",
      eventTime: "7/10/2026 7:00:00 AM",
      timestamp: 1_000_000,
      csvDurationSeconds: null,
    },
    {
      door: "Door A",
      eventType: "Door closed",
      eventTime: "7/10/2026 7:00:40 AM",
      timestamp: 1_040_000,
      csvDurationSeconds: null,
    },
  ];

  return buildExecutiveReport(
    runFireExitIntelligenceFromParsedEvents(events, ["Event", "Door", "Event timestamp"], [], {
      sourceFileName: "Sample.csv",
      config: { heldOpenThresholdSeconds: 15 },
      analyzedRowCount: events.length,
      hasDurationField: false,
      mapping,
    }).report,
  );
}

describe("POST /api/reports/executive-pdf", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  });

  it("returns a PDF when export data is available", async () => {
    vi.spyOn(buildExport, "buildExecutiveReportForExport").mockResolvedValue({
      ok: true,
      report: sampleReport(),
      reportingPeriodLabel: "All time",
    });
    vi.spyOn(renderPdf, "renderExecutiveReportPdf").mockResolvedValue(
      Buffer.from("%PDF-1.4 test"),
    );

    const response = await POST(
      new Request("http://localhost/api/reports/executive-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(
      "Exit-Compliance-Pro-Management-Review-",
    );
    expect(await response.arrayBuffer()).toEqual(
      Uint8Array.from(Buffer.from("%PDF-1.4 test")).buffer,
    );
  });

  it("returns 404 when no import data exists", async () => {
    vi.spyOn(buildExport, "buildExecutiveReportForExport").mockResolvedValue({
      ok: false,
      error: "No processed imports are available to generate a management review.",
      status: 404,
    });

    const response = await POST(
      new Request("http://localhost/api/reports/executive-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No processed imports are available to generate a management review.",
    });
  });

  it("returns 400 for invalid request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/reports/executive-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "custom" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Custom reporting periods require customStart and customEnd.",
    });
  });
});
