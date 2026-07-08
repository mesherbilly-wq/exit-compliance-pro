import { ReportPlaceholderContent } from "@/components/reports/report-placeholder-content";
import { getReportBySlug } from "@/lib/reports/config";

const report = getReportBySlug("occupancy")!;

export default function OccupancyReportPage() {
  return (
    <ReportPlaceholderContent
      report={report}
      features={[
        "Peak occupancy periods",
        "Estimated people onsite",
        "Entry and exit trends",
        "Busy period identification",
      ]}
    />
  );
}
