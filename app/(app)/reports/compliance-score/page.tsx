import { ReportPlaceholderContent } from "@/components/reports/report-placeholder-content";
import { getReportBySlug } from "@/lib/reports/config";

const report = getReportBySlug("compliance-score")!;

export default function ComplianceScoreReportPage() {
  return (
    <ReportPlaceholderContent
      report={report}
      features={[
        "Site, door and area compliance scores",
        "Forced event impact scoring",
        "Held-open event impact scoring",
        "Access denied trend analysis",
        "Unresolved exception tracking",
      ]}
    />
  );
}
