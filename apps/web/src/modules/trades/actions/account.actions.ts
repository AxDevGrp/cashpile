"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { NewAccountInput, TradesPropAccount } from "../types";

export async function listPropAccounts() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("trades_prop_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPropAccount(input: NewAccountInput) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("trades_prop_accounts")
    .insert({
      user_id: user.id,
      firm_name: input.firmName,
      account_label: input.accountLabel ?? null,
      account_size: input.accountSize,
      starting_balance: input.startingBalance,
      current_balance: input.startingBalance,
      currency: input.currency,
      max_daily_drawdown_pct: input.maxDailyDrawdownPct,
      max_total_drawdown_pct: input.maxTotalDrawdownPct,
      profit_target_pct: input.profitTargetPct ?? null,
      trailing_drawdown: input.trailingDrawdown,
      status: input.status,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/trades/accounts");
  return data;
}

export async function updatePropAccount(
  id: string,
  input: Partial<TradesPropAccount>
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("trades_prop_accounts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/trades/accounts");
  return data;
}

export async function deletePropAccount(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("trades_prop_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/trades/accounts");
}
