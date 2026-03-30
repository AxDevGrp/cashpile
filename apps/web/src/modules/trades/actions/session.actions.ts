"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";

export async function listSessions(accountId: string, limit = 30) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("trades_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertSession(
  accountId: string,
  date: string,
  patch: {
    closing_balance?: number;
    daily_pnl?: number;
    drawdown_pct?: number;
    trade_count?: number;
    notes?: string;
  }
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  // Check if session exists
  const { data: existing } = await supabase
    .from("trades_sessions")
    .select("id")
    .eq("account_id", accountId)
    .eq("session_date", date)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("trades_sessions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/trades/performance");
    return data;
  }

  // Get account current balance for opening_balance
  const { data: account } = await supabase
    .from("trades_prop_accounts")
    .select("current_balance")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  const { data, error } = await supabase
    .from("trades_sessions")
    .insert({
      user_id: user.id,
      account_id: accountId,
      session_date: date,
      opening_balance: account?.current_balance ?? 0,
      ...patch,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/trades/performance");
  return data;
}

export async function getOrCreateTodaySession(accountId: string) {
  const today = new Date().toISOString().split("T")[0];
  return upsertSession(accountId, today, {});
}
