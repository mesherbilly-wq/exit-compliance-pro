import { ReportPlaceholderContent } from "@/components/reports/report-placeholder-content";
import { getReportBySlug } from "@/lib/reports/config";

const report = getReportBySlug("heat-map")!;

export default function HeatMapReportPage() {
  return (
    <ReportPlaceholderContent
      report={report}
      features={[
        "Busy access points",
        "High-traffic doors",
        "Time-of-day activity patterns",
        "Operational pressure points",
      ]}
    />
  );
}
