import { getServerEnv } from "@/lib/server/env";
import {
  createInboundEmail,
  createServerImport,
  findInboundEmailByProviderId,
  updateInboundEmailStatus,
  uploadCsvToStorage,
} from "@/lib/server/db/inbound-email-repository";
import {
  downloadAttachmentText,
  fetchReceivedEmail,
  listReceivedEmailAttachments,
} from "@/lib/server/inbound-email/resend-client";
import {
  isCsvAttachment,
  looksLikeCsvContent,
  sanitizeAttachmentFileName,
  type AttachmentCandidate,
} from "@/lib/server/inbound-email/attachment-validation";
import { processCsvImport } from "@/lib/server/imports/process-csv-import";
import type { InboundEmailStatus } from "@/lib/server/types/inbound-email";

export type ResendEmailReceivedEvent = {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    from: string;
    to: string[];
    subject: string | null;
    attachments?: Array<{
      id: string;
      filename: string;
      content_type?: string | null;
      size?: number | null;
    }>;
  };
};

export type ProcessInboundEmailResult =
  | { ok: true; idempotent: true; providerEmailId: string }
  | {
      ok: true;
      idempotent: false;
      providerEmailId: string;
      inboundEmailId: string;
      importId?: string;
      status: InboundEmailStatus;
      message: string;
    }
  | {
      ok: false;
      providerEmailId?: string;
      status: InboundEmailStatus;
      message: string;
    };

function logInbound(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      scope: "inbound-email",
      event,
      ...details,
      at: new Date().toISOString(),
    }),
  );
}

function pickCsvAttachment(
  attachments: AttachmentCandidate[],
  maxBytes: number,
): AttachmentCandidate | null {
  for (const attachment of attachments) {
    if (!isCsvAttachment(attachment)) {
      continue;
    }

    if (attachment.size !== null && attachment.size > maxBytes) {
      continue;
    }

    return attachment;
  }

  return null;
}

export async function processInboundEmailEvent(
  event: ResendEmailReceivedEvent,
): Promise<ProcessInboundEmailResult> {
  const env = getServerEnv();
  const providerEmailId = event.data.email_id;

  logInbound("received", {
    providerEmailId,
    from: event.data.from,
    subject: event.data.subject,
  });

  const existing = await findInboundEmailByProviderId(providerEmailId);
  if (existing) {
    logInbound("duplicate", { providerEmailId, inboundEmailId: existing.id });
    return { ok: true, idempotent: true, providerEmailId };
  }

  const toAddress = event.data.to[0] ?? env.inboundReportEmail;
  let inboundEmailId: string | null = null;

  try {
    const inboundEmail = await createInboundEmail({
      providerEmailId,
      fromAddress: event.data.from,
      toAddress,
      subject: event.data.subject,
      receivedAt: event.data.created_at,
      status: "processing",
    });
    inboundEmailId = inboundEmail.id;

    await fetchReceivedEmail(providerEmailId);

    const attachments = await listReceivedEmailAttachments(providerEmailId);
    const csvAttachment = pickCsvAttachment(
      attachments,
      env.inboundMaxAttachmentBytes,
    );

    if (!csvAttachment) {
      const reason = "No valid CSV attachment found in inbound email.";
      await updateInboundEmailStatus(inboundEmailId, "rejected", reason);
      logInbound("rejected", { providerEmailId, reason });
      return {
        ok: false,
        providerEmailId,
        status: "rejected",
        message: reason,
      };
    }

    const csvText = await downloadAttachmentText(csvAttachment);
    if (!looksLikeCsvContent(csvText)) {
      const reason = "Attachment did not contain parseable CSV content.";
      await updateInboundEmailStatus(inboundEmailId, "rejected", reason);
      logInbound("rejected", { providerEmailId, reason });
      return {
        ok: false,
        providerEmailId,
        status: "rejected",
        message: reason,
      };
    }

    if (
      csvAttachment.size !== null &&
      csvAttachment.size > env.inboundMaxAttachmentBytes
    ) {
      const reason = "CSV attachment exceeds the configured maximum size.";
      await updateInboundEmailStatus(inboundEmailId, "rejected", reason);
      return {
        ok: false,
        providerEmailId,
        status: "rejected",
        message: reason,
      };
    }

    const safeFileName = sanitizeAttachmentFileName(csvAttachment.filename);
    const importResult = processCsvImport({
      fileName: safeFileName,
      csvText,
      source: "inbound_email",
    });

    const storagePath = `inbound/${providerEmailId}/${safeFileName}`;

    if (!importResult.ok) {
      await updateInboundEmailStatus(
        inboundEmailId,
        importResult.status,
        importResult.reason,
      );
      logInbound("failed", {
        providerEmailId,
        reason: importResult.reason,
      });
      return {
        ok: false,
        providerEmailId,
        status: importResult.status,
        message: importResult.reason,
      };
    }

    await uploadCsvToStorage(storagePath, csvText, env.supabaseStorageBucket);

    const importRecord = await createServerImport({
      source: "inbound_email",
      fileName: safeFileName,
      originalFilePath: storagePath,
      rowCount: importResult.rowCount,
      columnCount: importResult.columnCount,
      headers: importResult.headers,
      fieldMapping: importResult.analysisSnapshot.mapping,
      analysisSnapshot: importResult.analysisSnapshot,
      status: importResult.status,
      inboundEmailId,
      processingResult: importResult.processingResult,
    });

    await updateInboundEmailStatus(inboundEmailId, "processed");

    logInbound("processed", {
      providerEmailId,
      inboundEmailId,
      importId: importRecord.id,
      rowCount: importResult.rowCount,
    });

    return {
      ok: true,
      idempotent: false,
      providerEmailId,
      inboundEmailId,
      importId: importRecord.id,
      status: "processed",
      message: importResult.processingResult,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unexpected inbound email failure.";

    if (inboundEmailId) {
      await updateInboundEmailStatus(inboundEmailId, "failed", reason);
    }

    logInbound("error", { providerEmailId, reason });
    return {
      ok: false,
      providerEmailId,
      status: "failed",
      message: reason,
    };
  }
}
