export type ServerEnv = {
  resendApiKey: string;
  resendWebhookSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  inboundReportEmail: string;
  inboundMaxAttachmentBytes: number;
};

const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getServerEnv(): ServerEnv {
  const maxBytes = Number(process.env.INBOUND_MAX_ATTACHMENT_BYTES ?? DEFAULT_MAX_ATTACHMENT_BYTES);

  return {
    resendApiKey: readRequired("RESEND_API_KEY"),
    resendWebhookSecret: readRequired("RESEND_WEBHOOK_SECRET"),
    supabaseUrl: readRequired("SUPABASE_URL"),
    supabaseServiceRoleKey: readRequired("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseStorageBucket: readRequired("SUPABASE_STORAGE_BUCKET"),
    inboundReportEmail: readRequired("INBOUND_REPORT_EMAIL"),
    inboundMaxAttachmentBytes:
      Number.isFinite(maxBytes) && maxBytes > 0
        ? maxBytes
        : DEFAULT_MAX_ATTACHMENT_BYTES,
  };
}

export function getPublicInboundEmail(): string | null {
  return process.env.INBOUND_REPORT_EMAIL?.trim() ?? null;
}

export function isInboundEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_WEBHOOK_SECRET &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_STORAGE_BUCKET &&
      process.env.INBOUND_REPORT_EMAIL,
  );
}
