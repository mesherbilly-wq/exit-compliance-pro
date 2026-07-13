import { renderToBuffer } from "@react-pdf/renderer";
import { ExecutiveReportDocument } from "@/components/pdf/executive-report-document";
import type { ExecutiveReportPdfData } from "@/lib/reports/executive-report-pdf-types";

export async function renderExecutiveReportPdf(
  data: ExecutiveReportPdfData,
): Promise<Buffer> {
  const buffer = await renderToBuffer(<ExecutiveReportDocument data={data} />);
  return Buffer.from(buffer);
}
