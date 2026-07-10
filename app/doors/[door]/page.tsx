import { DoorProfileContent } from "@/components/doors/door-profile-content";

type DoorProfilePageProps = {
  params: Promise<{ door: string }>;
};

export default async function DoorProfilePage({ params }: DoorProfilePageProps) {
  const { door } = await params;
  return <DoorProfileContent doorParam={door} />;
}
