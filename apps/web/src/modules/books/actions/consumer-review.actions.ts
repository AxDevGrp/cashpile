"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidateConsumerPaths } from "@/lib/revalidate-consumer";
import { listConsumerReview, saveConsumerReview } from "../services/consumer-review";

// Owner identity always comes from the session; a supplied userId is never
// forwarded. The save RPC re-validates category ownership in SQL.
async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return { supabase: supabase as any, userId: user.id };
}

export async function listConsumerReviewAction(input: unknown) {
  const { supabase, userId } = await requireUser();
  return listConsumerReview(supabase, userId, input);
}

export async function saveConsumerReviewAction(input: unknown) {
  const { supabase, userId } = await requireUser();
  const result = await saveConsumerReview(supabase, userId, input);
  revalidateConsumerPaths();
  return result;
}
