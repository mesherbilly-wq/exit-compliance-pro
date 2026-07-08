import { FeaturePlaceholder } from "@/components/ui/section-page-shell";

export default function TrendsPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Trends"
      title="Compliance Trends"
      description="Track held-open exit event trends, exception patterns and improving or declining fire exit performance over time."
      features={[
        "Held-open event trend analysis",
        "Forced-open incident patterns",
        "Compliance score movement over time",
        "Repeat issue door trend tracking",
        "Period-over-period life safety comparison",
      ]}
    />
  );
}
