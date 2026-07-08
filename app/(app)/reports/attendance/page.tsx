import { ReportPlaceholderContent } from "@/components/reports/report-placeholder-content";
import { getReportBySlug } from "@/lib/reports/config";

const report = getReportBySlug("attendance")!;

export default function AttendanceReportPage() {
  return (
    <ReportPlaceholderContent
      report={report}
      features={[
        "Who attended site and when",
        "First seen and last seen per person",
        "Total people on site",
        "Department breakdown",
        "Daily attendance summary",
      ]}
    />
  );
}
