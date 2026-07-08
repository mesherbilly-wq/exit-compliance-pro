import { FeaturePlaceholder } from "@/components/ui/section-page-shell";

export default function HeatMapsPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Heat Maps"
      title="Operational Heat Maps"
      description="Visualise high-traffic fire exit doors, operational pressure points and time-of-day life safety hotspots."
      features={[
        "High-pressure exit door identification",
        "Busy access point mapping",
        "Time-of-day activity patterns",
        "Operational pressure point analysis",
        "Site and floor-level heat map views",
      ]}
    />
  );
}
