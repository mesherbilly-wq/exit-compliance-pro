import { FeaturePlaceholder } from "@/components/ui/section-page-shell";

export default function ExecutiveReportsPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Executive Reports"
      title="Executive Reporting"
      description="Prepare board-ready summaries of fire exit compliance, life safety risk exposure and remediation priorities."
      features={[
        "Executive compliance summary",
        "Site-level risk exposure overview",
        "Top repeat issue exit doors",
        "Held-open and forced-open exception highlights",
        "Remediation priority recommendations",
      ]}
    />
  );
}
