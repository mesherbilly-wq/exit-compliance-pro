import { NextResponse } from "next/server";
import { parseAnalyticsConfigFromBody } from "@/lib/analytics/parse-analytics-config";
import {
  formatExecutiveReportPdfFilename,
  mapExecutiveReportToPdfData,
} from "@/lib/reports/executive-report-pdf-types";
import { parseExecutivePdfRequestBody } from "@/lib/reports/validate-executive-pdf-request";
import { buildExecutiveReportForExport } from "@/lib/server/reports/build-executive-report-for-export";
import { renderExecutiveReportPdf } from "@/lib/server/reports/render-executive-report-pdf";
import { isSupabaseConfigured } from "@/lib/server/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let payload: unknown = {};

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = parseExecutivePdfRequestBody(payload);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const config = parseAnalyticsConfigFromBody(validation.body);

  try {
    const exportResult = await buildExecutiveReportForExport({
      config,
      period: validation.body.period,
      customStart: validation.body.customStart,
      customEnd: validation.body.customEnd,
    });

    if (!exportResult.ok) {
      return NextResponse.json(
        { error: exportResult.error },
        { status: exportResult.status },
      );
    }

    const generatedAt = new Date();
    const pdfData = mapExecutiveReportToPdfData(
      exportResult.report,
      exportResult.reportingPeriodLabel,
      generatedAt,
    );
    const pdfBuffer = await renderExecutiveReportPdf(pdfData);
    const filename = formatExecutiveReportPdfFilename(generatedAt);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Executive PDF generation failed:", error);

    return NextResponse.json(
      {
        error:
          "Management review PDF generation failed. Please try again shortly.",
      },
      { status: 500 },
    );
  }
}
