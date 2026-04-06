"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { PulseWatchlistItem } from "../types";

export async function listWatchlist(): Promise<PulseWatchlistItem[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("pulse_watchlist")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addToWatchlist(
  instrument: string,
  alertThresholdPct = 1.0
): Promise<PulseWatchlistItem> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("pulse_watchlist")
    .upsert(
      {
        user_id: user.id,
        instrument: instrument.toUpperCase().trim(),
        alert_threshold_pct: alertThresholdPct,
        is_active: true,
      },
      { onConflict: "user_id,instrument" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/pulse/watchlist");
  return data;
}

export async function removeFromWatchlist(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("pulse_watchlist")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/pulse/watchlist");
}

export async function toggleWatchlistItem(
  id: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("pulse_watchlist")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/pulse/watchlist");
}

export async function getUserInstruments(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: watchlist } = await supabase
    .from("pulse_watchlist")
    .select("instrument")
    .eq("user_id", user.id)
    .eq("is_active", true);

  return watchlist?.map((w) => w.instrument) || [];
}
