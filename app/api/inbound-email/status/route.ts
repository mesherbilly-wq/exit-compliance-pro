import { NextResponse } from "next/server";
import { getInboundEmailSummary } from "@/lib/server/db/inbound-email-repository";
import {
  getPublicInboundEmail,
  isInboundEmailConfigured,
} from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET() {
  const inboundEmailAddress = getPublicInboundEmail();
  const configured = isInboundEmailConfigured();

  if (!configured) {
    return NextResponse.json({
      configured: false,
      inboundEmailAddress,
      webhookStatus: "Not configured",
      lastReceived: null,
      lastSuccessfulImport: null,
      lastFailure: null,
    });
  }

  try {
    const summary = await getInboundEmailSummary();

    return NextResponse.json({
      configured: true,
      inboundEmailAddress,
      webhookStatus: "Configured",
      lastReceived: summary.lastReceived,
      lastSuccessfulImport: summary.lastSuccessfulImport,
      lastFailure: summary.lastFailure,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        inboundEmailAddress,
        webhookStatus: "Configuration error",
        lastReceived: null,
        lastSuccessfulImport: null,
        lastFailure: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
