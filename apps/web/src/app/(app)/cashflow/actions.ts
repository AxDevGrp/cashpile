"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { CashflowRole } from "@cashpile/ai";

const ROLES: CashflowRole[] = ["spending_source", "reserve", "credit_liability", "investment", "loan", "ignore"];

export async function updateAccountPlanSettings(input: {
  accountId: string;
  role?: CashflowRole;
  included?: boolean;
  isEmergency?: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const accountId = String(input.accountId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw new Error("invalid account id");

  const update: Record<string, unknown> = {};
  if (input.role !== undefined) {
    if (!ROLES.includes(input.role)) throw new Error("invalid role");
    update.cashflow_role = input.role;
    if (input.role !== "reserve") update.is_emergency = false;
  }
  if (input.included !== undefined) update.cashflow_include = !!input.included;
  if (input.isEmergency !== undefined) {
    if (input.isEmergency && (input.role ?? "reserve") !== "reserve") throw new Error("only reserve accounts can be emergency funds");
    update.is_emergency = !!input.isEmergency;
  }
  if (!Object.keys(update).length) throw new Error("nothing to update");

  const { data, error } = await supabase
    .from("books_financial_accounts")
    .update(update)
    .eq("id", accountId)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Account not found");

  revalidatePath("/cashflow");
  revalidatePath("/cashflow/recurring");
  revalidatePath("/cashboard");
}