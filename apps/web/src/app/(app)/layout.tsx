import { getTaxTestingAccess } from "@/lib/tax-access";
import { AppShell } from "./_components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell taxEnabled={await getTaxTestingAccess()}>{children}</AppShell>;
}
