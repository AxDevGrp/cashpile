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
