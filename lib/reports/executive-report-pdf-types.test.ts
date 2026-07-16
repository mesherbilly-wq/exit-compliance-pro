import { describe, expect, it } from "vitest";
import { buildExecutiveReport } from "@/lib/analytics/executive-report";
import { runFireExitIntelligenceFromParsedEvents } from "@/lib/analytics/fire-exit-intelligence-engine";
import type { FieldMapping } from "@/lib/imports/types";
import {
  formatExecutiveReportPdfFilename,
  mapExecutiveReportToPdfData,
  sanitizePdfText,
} from "@/lib/reports/executive-report-pdf-types";

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

function buildSampleExecutiveReport() {
  const events = [
    {
      door: "Rear Loading Bay",
      eventType: "Door opened",
      eventTime: "7/10/2026 7:00:00 AM",
      timestamp: 1_000_000,
      csvDurationSeconds: null,
    },
    {
      door: "Rear Loading Bay",
      eventType: "Door open too long",
      eventTime: "7/10/2026 7:00:20 AM",
      timestamp: 1_020_000,
      csvDurationSeconds: null,
    },
    {
      door: "Rear Loading Bay",
      eventType: "Door closed",
      eventTime: "7/10/2026 7:01:10 AM",
      timestamp: 1_070_000,
      csvDurationSeconds: null,
    },
    {
      door: "Level 2 Adj Toilet",
      eventType: "Door opened",
      eventTime: "7/11/2026 8:00:00 AM",
      timestamp: 2_000_000,
      csvDurationSeconds: null,
    },
    {
      door: "Level 2 Adj Toilet",
      eventType: "Door closed",
      eventTime: "7/11/2026 8:00:25 AM",
      timestamp: 2_025_000,
      csvDurationSeconds: null,
    },
  ];

  const intelligence = runFireExitIntelligenceFromParsedEvents(
    events,
    ["Event", "Door", "Event timestamp"],
    [],
    {
      sourceFileName: "Sample import.csv",
      config: { heldOpenThresholdSeconds: 15 },
      analyzedRowCount: events.length,
      hasDurationField: false,
      mapping,
    },
  ).report;

  return buildExecutiveReport(intelligence, "2026-07-13T12:00:00.000Z");
}

describe("executive report PDF mapping", () => {
  it("maps executive report analytics into PDF payload fields", () => {
    const report = buildSampleExecutiveReport();
    const pdfData = mapExecutiveReportToPdfData(
      report,
      "Last 7 days",
      new Date("2026-07-13T12:00:00.000Z"),
    );

    expect(pdfData.productName).toBe("Exit Compliance Pro");
    expect(pdfData.reportTitle).toBe("Management Review");
    expect(pdfData.reportingPeriodLabel).toBe("Last 7 days");
    expect(pdfData.overallComplianceScore).toBe(report.overallComplianceScore);
    expect(pdfData.siteHealthRating).toBe(report.siteHealthRating);
    expect(pdfData.complianceTrendDirection).toBe(report.complianceTrend.direction);
    expect(pdfData.doorsMonitored).toBe(report.totalDoors);
    expect(pdfData.complianceIncidents).toBeGreaterThan(0);
    expect(pdfData.timeBeyondThresholdLabel).toBe(report.totalExposureLabel);
    expect(pdfData.longestIncidentLabel).not.toBe("N/A");
    expect(pdfData.topComplianceRisks.length).toBeGreaterThan(0);
    expect(pdfData.recommendations.length).toBeGreaterThan(0);
  });

  it("formats the PDF filename with the report date", () => {
    expect(
      formatExecutiveReportPdfFilename(new Date("2026-07-13T09:30:00.000Z")),
    ).toBe("Exit-Compliance-Pro-Management-Review-2026-07-13.pdf");
  });

  it("sanitizes unsafe control characters from labels", () => {
    expect(sanitizePdfText("Door\u0001A")).toBe("DoorA");
  });
});

describe("sanitizePdfText", () => {
  it("trims and limits long labels", () => {
    expect(sanitizePdfText(`  ${"x".repeat(600)}  `).length).toBeLessThanOrEqual(500);
  });
});
