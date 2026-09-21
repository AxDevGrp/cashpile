"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";

export async function setPriorityPinned(pinned: boolean) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("cashflow_action_state")
    .upsert(
      { user_id: user.id, action_key: "priority_pin", pinned: !!pinned },
      { onConflict: "user_id,action_key" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/cashboard");
}

export async function dismissNextStep(ruleKey: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const key = String(ruleKey ?? "");
  if (!/^[a-z0-9_]+:[A-Za-z0-9_:-]{0,64}$/.test(key)) throw new Error("invalid rule key");

  const { error } = await supabase
    .from("cashflow_action_state")
    .upsert(
      { user_id: user.id, action_key: `next_step:${key}`, dismissed_at: new Date().toISOString() },
      { onConflict: "user_id,action_key" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/cashboard");
}