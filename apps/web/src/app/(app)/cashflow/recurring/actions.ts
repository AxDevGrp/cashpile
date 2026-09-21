"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { computeRecurringIdentity } from "@cashpile/ai";
import { revalidatePath } from "next/cache";
import type { RecurringCadence, RecurringFlowKind, RecurringItem } from "@cashpile/ai";

const CADENCES: RecurringCadence[] = ["weekly", "biweekly", "monthly", "quarterly", "annual"];

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return { supabase, user };
}

function validateAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be a positive number");
  return Math.round(amount * 100) / 100;
}

function validateNextDate(value: unknown): string {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("next date must be a valid date (YYYY-MM-DD)");
  }
  return date;
}

function validateCadence(value: unknown): RecurringCadence {
  const cadence = String(value ?? "");
  if (!CADENCES.includes(cadence as RecurringCadence)) throw new Error("unsupported cadence");
  return cadence as RecurringCadence;
}

function anchorDaysFor(cadence: RecurringCadence, nextDate: string): number[] | null {
  if (cadence === "monthly" || cadence === "quarterly" || cadence === "annual") {
    return [new Date(`${nextDate}T00:00:00.000Z`).getUTCDate()];
  }
  return null;
}

interface ProposalPayload {
  stableKey: string;
  direction: "income" | "expense";
  merchant: string;
  descriptionPattern: string;
  amountBucket: number;
  accountIds: string[];
  anchorDaysOfMonth?: number[];
  lastSeenDate?: string;
  flowKind?: RecurringFlowKind;
  counterpartyAccountIds?: string[];
}

function rowFromProposal(proposal: ProposalPayload, input: { amount: number; cadence: RecurringCadence; nextDate: string }) {
  return {
    direction: proposal.direction,
    merchant: proposal.merchant,
    description_pattern: proposal.descriptionPattern,
    amount_bucket: proposal.amountBucket,
    account_ids: proposal.accountIds,
    last_seen_date: proposal.lastSeenDate ?? null,
    flow_kind: proposal.flowKind ?? "standard",
    counterparty_account_ids: proposal.counterpartyAccountIds ?? [],
    amount: input.amount,
    cadence: input.cadence,
    next_date: input.nextDate,
    included: true,
    confirmed_at: new Date().toISOString(),
  };
}

export async function saveRecurringCorrection(input: {
  id?: string;
  proposal?: RecurringItem;
  amount: number;
  cadence: RecurringCadence;
  nextDate: string;
}) {
  const { supabase, user } = await requireUser();
  const amount = validateAmount(input.amount);
  const cadence = validateCadence(input.cadence);
  const nextDate = validateNextDate(input.nextDate);

  if (input.id) {
    const { data, error } = await supabase
      .from("cashflow_recurring_items")
      .update({
        amount,
        cadence,
        next_date: nextDate,
        anchor_days_of_month: anchorDaysFor(cadence, nextDate),
        included: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Recurring item not found");
  } else if (input.proposal?.stableKey) {
    const proposal = input.proposal;
    const stableKey = input.proposal.stableKey;
    const { error } = await supabase
      .from("cashflow_recurring_items")
      .upsert(
        {
          user_id: user.id,
          stable_key: stableKey,
          ...rowFromProposal(
            {
              stableKey,
              direction: proposal.direction,
              merchant: proposal.merchant,
              descriptionPattern: proposal.descriptionPattern,
              amountBucket: Math.round(Math.abs(proposal.averageAmount) / 5) * 5,
              accountIds: proposal.accountIds,
              anchorDaysOfMonth: proposal.anchorDaysOfMonth,
              lastSeenDate: proposal.lastSeenDate,
              flowKind: proposal.flowKind,
              counterpartyAccountIds: proposal.counterpartyAccountIds,
            },
            { amount, cadence, nextDate },
          ),
          anchor_days_of_month: anchorDaysFor(cadence, nextDate),
        },
        { onConflict: "user_id,stable_key" },
      );
    if (error) throw new Error(error.message);
  } else {
    throw new Error("Provide an item to correct");
  }

  revalidatePath("/cashflow/recurring");
  revalidatePath("/cashflow");
  revalidatePath("/cashboard");
}

export async function setRecurringExcluded(input: { id?: string; proposal?: RecurringItem; excluded: boolean }) {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();

  if (input.id) {
    const { data, error } = await supabase
      .from("cashflow_recurring_items")
      .update({ included: !input.excluded, confirmed_at: now })
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Recurring item not found");
  } else if (input.proposal?.stableKey) {
    const proposal = input.proposal;
    const identity = computeRecurringIdentity(proposal.direction, proposal.merchant, proposal.averageAmount);
    const { error } = await supabase
      .from("cashflow_recurring_items")
      .upsert(
        {
          user_id: user.id,
          stable_key: identity.stableKey,
          direction: proposal.direction,
          merchant: proposal.merchant,
          description_pattern: identity.descriptionPattern,
          amount_bucket: identity.amountBucket,
          account_ids: proposal.accountIds,
          last_seen_date: proposal.lastSeenDate,
          flow_kind: proposal.flowKind ?? "standard",
          counterparty_account_ids: proposal.counterpartyAccountIds ?? [],
          amount: proposal.averageAmount,
          cadence: proposal.cadence,
          next_date: proposal.nextExpectedDate,
          anchor_days_of_month: proposal.anchorDaysOfMonth ?? null,
          included: !input.excluded,
          confirmed_at: now,
          source: "detected",
        },
        { onConflict: "user_id,stable_key" },
      );
    if (error) throw new Error(error.message);
  } else {
    throw new Error("Provide an item to update");
  }

  revalidatePath("/cashflow/recurring");
  revalidatePath("/cashflow");
  revalidatePath("/cashboard");
}

export async function setSubscriptionReview(input: { id?: string; proposal?: RecurringItem; status: "keep" | "review" | "cancel_help" }) {
  const { supabase, user } = await requireUser();
  if (!["keep", "review", "cancel_help"].includes(input.status)) throw new Error("invalid review status");
  const now = new Date().toISOString();

  if (input.id) {
    const { data, error } = await supabase
      .from("cashflow_recurring_items")
      .update({ review_status: input.status, is_subscription: true, confirmed_at: now })
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Recurring item not found");
  } else if (input.proposal?.stableKey) {
    const proposal = input.proposal;
    const identity = computeRecurringIdentity(proposal.direction, proposal.merchant, proposal.averageAmount);
    const { error } = await supabase
      .from("cashflow_recurring_items")
      .upsert(
        {
          user_id: user.id,
          stable_key: identity.stableKey,
          direction: proposal.direction,
          merchant: proposal.merchant,
          description_pattern: identity.descriptionPattern,
          amount_bucket: identity.amountBucket,
          account_ids: proposal.accountIds,
          last_seen_date: proposal.lastSeenDate,
          flow_kind: proposal.flowKind ?? "standard",
          counterparty_account_ids: proposal.counterpartyAccountIds ?? [],
          amount: proposal.averageAmount,
          cadence: proposal.cadence,
          next_date: proposal.nextExpectedDate,
          anchor_days_of_month: proposal.anchorDaysOfMonth ?? null,
          included: true,
          confirmed_at: now,
          is_subscription: true,
          review_status: input.status,
          source: "detected",
        },
        { onConflict: "user_id,stable_key" },
      );
    if (error) throw new Error(error.message);
  } else {
    throw new Error("Provide an item to review");
  }

  revalidatePath("/cashflow/recurring");
  revalidatePath("/cashflow");
  revalidatePath("/cashboard");
}

export async function addManualRecurringItem(input: {
  direction: "income" | "expense";
  merchant: string;
  amount: number;
  cadence: RecurringCadence;
  nextDate: string;
}) {
  const { supabase, user } = await requireUser();
  const merchant = String(input.merchant ?? "").trim().slice(0, 100);
  if (!merchant) throw new Error("merchant is required");
  const amount = validateAmount(input.amount);
  const cadence = validateCadence(input.cadence);
  const nextDate = validateNextDate(input.nextDate);
  if (input.direction !== "income" && input.direction !== "expense") throw new Error("invalid direction");

  const identity = computeRecurringIdentity(input.direction, merchant, amount);
  const { error } = await supabase
    .from("cashflow_recurring_items")
    .upsert(
      {
        user_id: user.id,
        stable_key: identity.stableKey,
        direction: input.direction,
        merchant,
        description_pattern: identity.descriptionPattern,
        amount_bucket: identity.amountBucket,
        account_ids: [],
        amount,
        cadence,
        next_date: nextDate,
        anchor_days_of_month: anchorDaysFor(cadence, nextDate),
        included: true,
        confirmed_at: new Date().toISOString(),
        source: "manual",
      },
      { onConflict: "user_id,stable_key" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/cashflow/recurring");
  revalidatePath("/cashflow");
  revalidatePath("/cashboard");
}