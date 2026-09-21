import { createServerSupabaseClient } from "@cashpile/db";
import { PageHeader } from "@cashpile/ui";
import SettingsClient from "./_components/settings-client";

export const metadata = { title: "Settings | Cashpile" };

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profile = {
    email: user?.email ?? "",
    display_name: (user?.user_metadata?.display_name as string) ?? "",
    preferred_currency: (user?.user_metadata?.preferred_currency as string) ?? "USD",
  };

  const integrations = {
    mirofish: !!(process.env.MIROFISH_URL),
    deepseek: !!(process.env.DEEPSEEK_API_KEY),
  };

  const { data: cashflowPrefs } = await supabase
    .from("user_settings")
    .select("minimum_cash_buffer, timezone, essential_weekly_allowance, emergency_target_months")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const cashflow = {
    minimumCashBuffer: cashflowPrefs?.minimum_cash_buffer == null ? null : Number(cashflowPrefs.minimum_cash_buffer),
    timezone: cashflowPrefs?.timezone ?? "America/New_York",
    essentialWeeklyAllowance: cashflowPrefs?.essential_weekly_allowance == null ? null : Number(cashflowPrefs.essential_weekly_allowance),
    emergencyTargetMonths: cashflowPrefs?.emergency_target_months == null ? null : Number(cashflowPrefs.emergency_target_months),
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <PageHeader title="Settings" description="Manage your profile, preferences, and integrations" />
      <SettingsClient profile={profile} integrations={integrations} cashflow={cashflow} />
    </div>
  );
}
