import { createServerSupabaseClient } from "@cashpile/db";
import { PageHeader } from "@cashpile/ui";
import SettingsClient from "./_components/settings-client";

export const metadata = { title: "Settings | Cashpile" };

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = {
    email: user?.email ?? "",
    display_name: (user?.user_metadata?.display_name as string) ?? "",
    preferred_currency:
      (user?.user_metadata?.preferred_currency as string) ?? "USD",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your profile and preferences"
      />
      <SettingsClient profile={profile} />
    </div>
  );
}
