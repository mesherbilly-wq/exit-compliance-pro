import { Resend } from "resend";
import { getServerEnv } from "@/lib/server/env";
import type { AttachmentCandidate } from "@/lib/server/inbound-email/attachment-validation";

const RESEND_API_BASE = "https://api.resend.com";

export type ResendReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  created_at: string;
};

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(getServerEnv().resendApiKey);
  }

  return resendClient;
}

export function resetResendClientForTests(): void {
  resendClient = null;
}

async function resendApiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getServerEnv().resendApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Resend API request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

type ReceivedEmailResponse = {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  created_at: string;
};

type AttachmentListResponse = {
  data: Array<{
    id: string;
    filename: string;
    content_type?: string | null;
    download_url: string;
    size?: number | null;
  }>;
};

export async function fetchReceivedEmail(
  emailId: string,
): Promise<ResendReceivedEmail> {
  const data = await resendApiGet<ReceivedEmailResponse>(
    `/emails/receiving/${emailId}`,
  );

  return {
    id: data.id,
    from: data.from,
    to: data.to,
    subject: data.subject ?? null,
    created_at: data.created_at,
  };
}

export async function listReceivedEmailAttachments(
  emailId: string,
): Promise<AttachmentCandidate[]> {
  const data = await resendApiGet<AttachmentListResponse>(
    `/emails/receiving/${emailId}/attachments`,
  );

  return data.data.map((attachment) => ({
    id: attachment.id,
    filename: attachment.filename,
    contentType: attachment.content_type ?? null,
    downloadUrl: attachment.download_url,
    size: attachment.size ?? null,
  }));
}

export async function downloadAttachmentText(
  attachment: AttachmentCandidate,
): Promise<string> {
  const response = await fetch(attachment.downloadUrl, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(
      `Attachment download failed with status ${response.status}.`,
    );
  }

  return response.text();
}

export function verifyResendWebhook(
  payload: string,
  headers: {
    id?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  },
  webhookSecret: string,
): unknown {
  const resend = getResendClient();

  return resend.webhooks.verify({
    payload,
    headers: {
      id: headers.id ?? "",
      timestamp: headers.timestamp ?? "",
      signature: headers.signature ?? "",
    },
    webhookSecret,
  });
}
