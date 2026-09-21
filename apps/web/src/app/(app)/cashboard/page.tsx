import { createServerSupabaseClient } from "@cashpile/db";
import LegacyDashboard from "./_components/legacy-dashboard";
import NewDashboard from "./_components/new-dashboard";

export default async function CashboardPage({ searchParams }: { searchParams?: Promise<{ gremmy?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: flag } = await supabase
    .from("app_feature_flags")
    .select("enabled, cohorts")
    .eq("key", "decision_first_experience")
    .maybeSingle();
  const newExperience = !!flag && (flag.enabled || flag.cohorts.includes(user.id));

  if (!newExperience) return <LegacyDashboard searchParams={searchParams} />;
  return <NewDashboard />;
}