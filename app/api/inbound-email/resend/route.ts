import { NextResponse } from "next/server";
import { getServerEnv, isInboundEmailConfigured } from "@/lib/server/env";
import {
  processInboundEmailEvent,
  type ResendEmailReceivedEvent,
} from "@/lib/server/inbound-email/process-inbound-email";
import { verifyResendWebhook } from "@/lib/server/inbound-email/resend-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isInboundEmailConfigured()) {
    return NextResponse.json(
      { error: "Inbound email is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const env = getServerEnv();

  try {
    verifyResendWebhook(
      rawBody,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      env.resendWebhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: ResendEmailReceivedEvent;
  try {
    payload = JSON.parse(rawBody) as ResendEmailReceivedEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await processInboundEmailEvent(payload);

    if (result.ok && result.idempotent) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        providerEmailId: result.providerEmailId,
      });
    }

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        providerEmailId: result.providerEmailId,
        inboundEmailId: result.inboundEmailId,
        importId: result.importId,
        status: result.status,
        message: result.message,
      });
    }

    return NextResponse.json({
      ok: false,
      providerEmailId: result.providerEmailId,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "inbound-email",
        event: "route-error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );

    return NextResponse.json(
      { ok: false, message: "Inbound email processing failed." },
      { status: 200 },
    );
  }
}
