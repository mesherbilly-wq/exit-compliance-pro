import { FeaturePlaceholder } from "@/components/ui/section-page-shell";

export default function SettingsPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Settings"
      title="Platform Settings"
      description="Configure fire exit compliance thresholds, CSV field mappings, report templates and platform preferences."
      features={[
        "Compliance scoring thresholds",
        "Held-open event duration limits",
        "CSV field mapping defaults",
        "Report branding and templates",
        "Notification preferences",
      ]}
    />
  );
}
