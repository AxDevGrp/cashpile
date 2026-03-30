"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { NewTradeInput, CloseTradeInput } from "../types";

export async function listTrades(params: {
  accountId?: string;
  from?: string;
  to?: string;
  instrument?: string;
  isOpen?: boolean;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  let q = supabase
    .from("trades_entries")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("entry_time", { ascending: false });

  if (params.accountId) q = q.eq("account_id", params.accountId);
  if (params.instrument) q = q.eq("instrument", params.instrument);
  if (params.from) q = q.gte("entry_time", params.from);
  if (params.to) q = q.lte("entry_time", params.to);
  if (params.isOpen !== undefined) q = q.eq("is_open", params.isOpen);
  if (params.limit) q = q.limit(params.limit);
  if (params.offset && params.limit) {
    q = q.range(params.offset, params.offset + params.limit - 1);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0 };
}

export async function createTrade(input: NewTradeInput) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const commissions = input.commissions ?? 0;

  const { data, error } = await supabase
    .from("trades_entries")
    .insert({
      user_id: user.id,
      account_id: input.accountId,
      instrument: input.instrument,
      direction: input.direction,
      entry_price: input.entryPrice,
      size: input.size,
      entry_time: input.entryTime,
      initial_stop: input.initialStop ?? null,
      commissions,
      setup_tag: input.setupTag ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      is_open: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/trades/journal");
  return data;
}

export async function closeTrade(id: string, input: CloseTradeInput) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  // Fetch existing to compute R-multiple
  const { data: existing } = await supabase
    .from("trades_entries")
    .select("entry_price, initial_stop, direction, size")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const commissions = input.commissions ?? 0;
  const netPnl = input.grossPnl - commissions;

  // Compute R-multiple if we have a stop
  let rMultiple: number | null = null;
  if (existing?.initial_stop) {
    const riskPerUnit = Math.abs(existing.entry_price - existing.initial_stop);
    const riskAmount = riskPerUnit * existing.size;
    rMultiple = riskAmount > 0 ? netPnl / riskAmount : null;
  }

  const { data, error } = await supabase
    .from("trades_entries")
    .update({
      exit_price: input.exitPrice,
      exit_time: input.exitTime,
      gross_pnl: input.grossPnl,
      commissions,
      net_pnl: netPnl,
      r_multiple: rMultiple,
      is_open: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update account current_balance
  if (existing) {
    const { data: account } = await supabase
      .from("trades_prop_accounts")
      .select("current_balance")
      .eq("id", data.account_id)
      .eq("user_id", user.id)
      .single();

    if (account) {
      await supabase
        .from("trades_prop_accounts")
        .update({
          current_balance: account.current_balance + netPnl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.account_id)
        .eq("user_id", user.id);
    }
  }

  revalidatePath("/trades/journal");
  return data;
}

export async function updateTrade(
  id: string,
  input: { setup_tag?: string; notes?: string; tags?: string[] }
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("trades_entries")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/trades/journal");
  return data;
}

export async function deleteTrade(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("trades_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/trades/journal");
}
