import { getConsumerExperience } from "@/lib/consumer-experience";
import { AppLayoutClient } from "./_components/app-layout-client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { enabled } = await getConsumerExperience();
  return <AppLayoutClient consumerEnabled={enabled}>{children}</AppLayoutClient>;
}
