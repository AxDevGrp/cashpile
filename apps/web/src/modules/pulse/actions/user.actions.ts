"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import type { Plan } from "@cashpile/db";

export async function getUserPlan(): Promise<Plan> {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  return (subscription?.plan as Plan) || "free";
}

export async function getUserInstruments(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: watchlist } = await supabase
    .from("pulse_watchlist")
    .select("instrument")
    .eq("user_id", user.id)
    .eq("is_active", true);

  return watchlist?.map((w) => w.instrument) || [];
}
