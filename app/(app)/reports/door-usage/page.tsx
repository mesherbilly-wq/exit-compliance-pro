import { ReportPlaceholderContent } from "@/components/reports/report-placeholder-content";
import { getReportBySlug } from "@/lib/reports/config";

const report = getReportBySlug("door-usage")!;

export default function DoorUsageReportPage() {
  return (
    <ReportPlaceholderContent
      report={report}
      features={[
        "Most-used doors",
        "Least-used doors",
        "Unusual door activity detection",
        "Door usage trends over time",
      ]}
    />
  );
}
