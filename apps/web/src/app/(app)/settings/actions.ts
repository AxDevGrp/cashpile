"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";

export async function updateProfile(data: { display_name?: string; preferred_currency?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error("Unauthenticated");

  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: data.display_name,
      preferred_currency: data.preferred_currency,
    },
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function saveCashflowPreferences(input: {
  minimumCashBuffer: number | null;
  timezone: string;
  essentialWeeklyAllowance: number | null;
  emergencyTargetMonths: number | null;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const parseOptionalAmount = (value: number | null, label: string): number | null => {
    if (value === null || value === undefined || (typeof value === "number" && Number.isNaN(value))) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or a positive number`);
    return Math.round(n * 100) / 100;
  };

  const minimumCashBuffer = parseOptionalAmount(input.minimumCashBuffer, "minimum cash buffer");
  const essentialWeeklyAllowance = parseOptionalAmount(input.essentialWeeklyAllowance, "weekly allowance");
  const emergencyTargetMonths = (() => {
    if (input.emergencyTargetMonths === null || input.emergencyTargetMonths === undefined) return null;
    const n = Number(input.emergencyTargetMonths);
    if (!Number.isFinite(n) || n < 0 || n > 120) throw new Error("emergency target must be between 0 and 120 months");
    return Math.round(n * 100) / 100;
  })();

  const timezone = String(input.timezone ?? "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_+\-/]{2,63}$/.test(timezone)) throw new Error("invalid timezone");

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        minimum_cash_buffer: minimumCashBuffer,
        timezone,
        essential_weekly_allowance: essentialWeeklyAllowance,
        emergency_target_months: emergencyTargetMonths,
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/cashflow");
  revalidatePath("/cashboard");
}
