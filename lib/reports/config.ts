export type ReportStatus = "available" | "preview" | "requires_import";

export type ReportDefinition = {
  slug: string;
  title: string;
  description: string;
  status: ReportStatus;
  href: string;
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  available: "Available",
  preview: "Preview",
  requires_import: "Requires import",
};

export const REPORTS: ReportDefinition[] = [
  {
    slug: "exit-compliance",
    title: "Exit Compliance Report",
    description:
      "Analyse forced-open events, held-open events, access denied trends and door compliance exceptions from Genetec exports.",
    status: "available",
    href: "/reports/exit-compliance",
  },
  {
    slug: "attendance",
    title: "Attendance Report",
    description:
      "Shows who attended site, first seen, last seen, total people, department breakdown and daily attendance.",
    status: "preview",
    href: "/reports/attendance",
  },
  {
    slug: "occupancy",
    title: "Occupancy Report",
    description:
      "Shows peak occupancy, estimated people onsite, entry/exit trends and busy periods.",
    status: "preview",
    href: "/reports/occupancy",
  },
  {
    slug: "door-usage",
    title: "Door Usage Report",
    description:
      "Shows most-used doors, least-used doors, unusual door activity and usage trends.",
    status: "preview",
    href: "/reports/door-usage",
  },
  {
    slug: "heat-map",
    title: "Heat Map Report",
    description:
      "Shows busy access points, high-traffic doors, time-of-day activity and operational pressure points.",
    status: "preview",
    href: "/reports/heat-map",
  },
  {
    slug: "compliance-score",
    title: "Compliance Score Report",
    description:
      "Gives each site, door or area a compliance score based on forced events, held-open events, access denied trends and unresolved exceptions.",
    status: "preview",
    href: "/reports/compliance-score",
  },
  {
    slug: "custom",
    title: "Custom Report Builder",
    description:
      "Build bespoke reports from CSV fields, filters, grouping, date ranges and customer-specific requirements.",
    status: "preview",
    href: "/reports/custom",
  },
];

export function getReportBySlug(slug: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.slug === slug);
}
