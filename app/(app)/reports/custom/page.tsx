import { ReportPlaceholderContent } from "@/components/reports/report-placeholder-content";
import { getReportBySlug } from "@/lib/reports/config";

const report = getReportBySlug("custom")!;

export default function CustomReportPage() {
  return (
    <ReportPlaceholderContent
      report={report}
      features={[
        "Build reports from CSV fields",
        "Custom filters and grouping",
        "Date range selection",
        "Customer-specific report requirements",
      ]}
    />
  );
}
