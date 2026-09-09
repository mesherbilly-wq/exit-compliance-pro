import { getAnalyticsConfig } from "@/lib/analytics/config";
import { formatExecutiveReportPdfFilename } from "@/lib/reports/executive-report-pdf-types";
import type { TrendsPeriodPreset } from "@/lib/analytics/trends-period";

export type ExecutivePdfExportOptions = {
  period?: TrendsPeriodPreset;
  customStart?: string;
  customEnd?: string;
};

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadExecutiveReportPdf(
  options: ExecutivePdfExportOptions = {},
): Promise<void> {
  const config = getAnalyticsConfig();
  const response = await fetch("/api/reports/executive-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...config,
      period: options.period,
      customStart: options.customStart,
      customEnd: options.customEnd,
    }),
  });

  if (!response.ok) {
    let message = "Failed to generate management review PDF.";

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep default message when response is not JSON.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="(.+?)"/)?.[1] ??
    formatExecutiveReportPdfFilename();

  triggerBrowserDownload(blob, filename);
}
