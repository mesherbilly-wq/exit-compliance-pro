import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/inbound-email/resend/route";
import * as repository from "@/lib/server/db/inbound-email-repository";
import * as resendClient from "@/lib/server/inbound-email/resend-client";
import * as importProcessor from "@/lib/server/imports/import-processor";
import { processInboundEmailEvent } from "@/lib/server/inbound-email/process-inbound-email";

const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

const baseEvent = {
  type: "email.received" as const,
  created_at: "2026-07-10T10:00:00.000Z",
  data: {
    email_id: "email-123",
    created_at: "2026-07-10T10:00:00.000Z",
    from: "genetec@example.com",
    to: ["reports@inbound.example.com"],
    subject: "Daily fire exit report",
  },
};

const mockImportRecord = {
  id: "import-1",
  source: "inbound_email" as const,
  file_name: "genetec-headered.csv",
  original_file_path: null,
  row_count: 3,
  column_count: 3,
  headers: ["Event Time", "Event Type", "Door Name"],
  field_mapping: {},
  analysis_snapshot: null,
  status: "processed" as const,
  inbound_email_id: "inbound-1",
  processing_result: "Processed 3 rows through fire exit analytics.",
  created_at: baseEvent.created_at,
  reporting_period_start: null,
  reporting_period_end: null,
  processing_duration_ms: 120,
  sender: "genetec@example.com",
  door_count: 1,
  incident_count: 0,
  compliance_score_snapshot: 100,
  processing_log: [],
  error_count: 0,
  failed_csv_path: null,
  failed_csv_retention_until: null,
  has_analytics: true,
  has_duration_field: false,
};

describe("processInboundEmailEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_WEBHOOK_SECRET = "test-secret";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.SUPABASE_STORAGE_BUCKET = "inbound-csv";
    process.env.INBOUND_REPORT_EMAIL = "reports@inbound.example.com";
  });

  it("processes a valid CSV attachment end-to-end", async () => {
    vi.spyOn(repository, "findInboundEmailByProviderId").mockResolvedValue(null);
    vi.spyOn(repository, "createInboundEmail").mockResolvedValue({
      id: "inbound-1",
      provider_email_id: "email-123",
      from_address: baseEvent.data.from,
      to_address: baseEvent.data.to[0]!,
      subject: baseEvent.data.subject,
      received_at: baseEvent.data.created_at,
      status: "processing",
      failure_reason: null,
      created_at: baseEvent.created_at,
    });
    vi.spyOn(resendClient, "fetchReceivedEmail").mockResolvedValue({
      id: "email-123",
      from: baseEvent.data.from,
      to: baseEvent.data.to,
      subject: baseEvent.data.subject,
      created_at: baseEvent.data.created_at,
    });
    vi.spyOn(resendClient, "listReceivedEmailAttachments").mockResolvedValue([
      {
        id: "att-1",
        filename: "genetec-headered.csv",
        contentType: "text/csv",
        downloadUrl: "https://example.com/genetec.csv",
        size: 512,
      },
    ]);
    vi.spyOn(resendClient, "downloadAttachmentText").mockResolvedValue(
      readFixture("genetec-headered.csv"),
    );
    vi.spyOn(importProcessor, "completeImportProcessing").mockResolvedValue(
      mockImportRecord,
    );
    vi.spyOn(repository, "updateInboundEmailStatus").mockResolvedValue(undefined);

    const result = await processInboundEmailEvent(baseEvent);

    expect(result.ok).toBe(true);
    if (result.ok && !result.idempotent) {
      expect(result.status).toBe("processed");
      expect(result.importId).toBe("import-1");
    }
  });

  it("rejects emails without a valid CSV attachment", async () => {
    vi.spyOn(repository, "findInboundEmailByProviderId").mockResolvedValue(null);
    vi.spyOn(repository, "createInboundEmail").mockResolvedValue({
      id: "inbound-2",
      provider_email_id: "email-456",
      from_address: baseEvent.data.from,
      to_address: baseEvent.data.to[0]!,
      subject: baseEvent.data.subject,
      received_at: baseEvent.data.created_at,
      status: "processing",
      failure_reason: null,
      created_at: baseEvent.created_at,
    });
    vi.spyOn(resendClient, "fetchReceivedEmail").mockResolvedValue({
      id: "email-456",
      from: baseEvent.data.from,
      to: baseEvent.data.to,
      subject: baseEvent.data.subject,
      created_at: baseEvent.data.created_at,
    });
    vi.spyOn(resendClient, "listReceivedEmailAttachments").mockResolvedValue([
      {
        id: "att-2",
        filename: "report.pdf",
        contentType: "application/pdf",
        downloadUrl: "https://example.com/report.pdf",
        size: 1024,
      },
    ]);
    vi.spyOn(repository, "updateInboundEmailStatus").mockResolvedValue(undefined);

    const result = await processInboundEmailEvent({
      ...baseEvent,
      data: { ...baseEvent.data, email_id: "email-456" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("rejected");
      expect(result.message).toContain("No valid CSV attachment");
    }
  });

  it("returns an idempotent response for duplicate webhook delivery", async () => {
    vi.spyOn(repository, "findInboundEmailByProviderId").mockResolvedValue({
      id: "inbound-existing",
      provider_email_id: "email-123",
      from_address: baseEvent.data.from,
      to_address: baseEvent.data.to[0]!,
      subject: baseEvent.data.subject,
      received_at: baseEvent.data.created_at,
      status: "processed",
      failure_reason: null,
      created_at: baseEvent.created_at,
    });

    const result = await processInboundEmailEvent(baseEvent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.idempotent).toBe(true);
    }
  });
});

describe("POST /api/inbound-email/resend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid webhook signatures", async () => {
    vi.spyOn(resendClient, "verifyResendWebhook").mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await POST(
      new Request("http://localhost/api/inbound-email/resend", {
        method: "POST",
        body: JSON.stringify(baseEvent),
        headers: {
          "content-type": "application/json",
          "svix-id": "msg_123",
          "svix-timestamp": "1710000000",
          "svix-signature": "invalid",
        },
      }),
    );

    expect(response.status).toBe(401);
  });
});
