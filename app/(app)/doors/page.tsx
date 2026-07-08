import { FeaturePlaceholder } from "@/components/ui/section-page-shell";

export default function DoorsPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Doors"
      title="Fire Exit Door Health"
      description="Monitor fire exit door health, identify repeat issue doors and prioritise remediation across your estate."
      features={[
        "Exit door health scoring",
        "Repeat issue door identification",
        "Held-open and forced-open history per door",
        "Doors requiring immediate attention",
        "Door-level compliance status",
      ]}
    />
  );
}
