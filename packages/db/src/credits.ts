/**
 * AI Credit Service
 * All functions use the service-role client so they can run server-side
 * without a user session (e.g., webhooks, cron jobs).
 */

import { createServiceRoleClient } from "./server";
import { PLAN_MONTHLY_CREDITS } from "./types";
import type { Plan, Json } from "./types";

export interface CreditBalance {
  subscriptionCredits: number;
  topupCredits: number;
  total: number;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getUserCreditBalance(userId: string): Promise<CreditBalance> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("ai_credit_balances")
    .select("subscription_credits, topup_credits")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { subscriptionCredits: 0, topupCredits: 0, total: 0 };
  }

  return {
    subscriptionCredits: data.subscription_credits,
    topupCredits: data.topup_credits,
    total: data.subscription_credits + data.topup_credits,
  };
}

// ─── Deduct ───────────────────────────────────────────────────────────────────
// Calls the atomic SQL function that locks the row and depletes
// subscription credits first, then topup credits.
// Returns false if balance is insufficient (caller should block the request).

export async function deductCredits(
  userId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("deduct_ai_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_metadata: metadata,
  });

  if (error) {
    console.error("[credits] deductCredits error:", error.message);
    return false;
  }

  return data === true;
}

// ─── Grant subscription credits ───────────────────────────────────────────────
// Resets subscription_credits to the plan allowance on monthly renewal.
// Does NOT touch topup_credits (those never expire).

export async function grantSubscriptionCredits(
  userId: string,
  plan: Plan,
  reason = "monthly_reset"
): Promise<void> {
  const supabase = createServiceRoleClient();
  const amount = PLAN_MONTHLY_CREDITS[plan];

  const { error: upsertError } = await supabase
    .from("ai_credit_balances")
    .upsert(
      {
        user_id: userId,
        subscription_credits: amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("[credits] grantSubscriptionCredits error:", upsertError.message);
    return;
  }

  await supabase.from("ai_credit_ledger").insert({
    user_id: userId,
    type: "subscription_grant",
    amount,
    metadata: { plan, reason } as Json,
  });
}

// ─── Grant topup credits ──────────────────────────────────────────────────────
// Increments topup_credits atomically via the grant_topup_credits SQL function.
// These credits never expire.

export async function grantTopupCredits(
  userId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("grant_topup_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error("[credits] grantTopupCredits error:", error.message);
    return;
  }

  await supabase.from("ai_credit_ledger").insert({
    user_id: userId,
    type: "topup_grant",
    amount,
    metadata: metadata as Json,
  });
}
