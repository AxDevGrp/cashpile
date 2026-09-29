"use server";

import { assertTaxTestingAccess } from "@/lib/tax-access";
import { createServerSupabaseClient } from "@cashpile/db";
import { requireTaxModuleAccess, getTaxModuleAccess } from "@/lib/tax-access";
import { revalidatePath } from "next/cache";
import { revalidateConsumerPaths } from "@/lib/revalidate-consumer";
import type { BooksUda, BooksAccount, TaxEntity } from "../types";

// ─── Tax Entity Account Management ─────────────────────────────────────────
// Financial accounts can optionally be linked to Tax Entities

export async function getAccountsByTaxEntity(taxEntityId: string): Promise<BooksAccount[]> {
  await requireTaxModuleAccess();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  assertTaxTestingAccess(user);

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .select("*")
    .eq("tax_entity_id", taxEntityId)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as BooksAccount[];
}

export async function assignAccountToTaxEntity(
  accountId: string,
  taxEntityId: string | null
): Promise<BooksAccount & { assigned_transaction_count: number; unassigned_transaction_count: number }> {
  await requireTaxModuleAccess();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  assertTaxTestingAccess(user);

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .update({
      tax_entity_id: taxEntityId,
      updated_at: new Date().toISOString()
    })
    .eq("id", accountId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const accountTransactions: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error: transactionError } = await (supabase as any)
      .from("books_transactions")
      .select("id, amount, date, category_id")
      .eq("user_id", user.id)
      .eq("financial_account_id", accountId)
      .order("date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (transactionError) throw new Error(transactionError.message);
    accountTransactions.push(...(page ?? []));
    if (!page || page.length < pageSize) break;
  }

  let assignedTransactionCount = 0;
  let unassignedTransactionCount = 0;

  if (accountTransactions.length > 0) {
    const transactionIds = accountTransactions.map((transaction: any) => transaction.id);
    const chunkSize = 500;

    for (let i = 0; i < transactionIds.length; i += chunkSize) {
      const ids = transactionIds.slice(i, i + chunkSize);
      const { error: cleanupError } = await (supabase as any)
        .from("books_tax_transaction_views")
        .delete()
        .eq("user_id", user.id)
        .in("transaction_id", ids)
        .ilike("tax_notes", "Auto-assigned by account:%");

      if (cleanupError) throw new Error(cleanupError.message);
      unassignedTransactionCount += ids.length;
    }

    if (taxEntityId) {
      const rows = accountTransactions.map((transaction: any) => ({
        user_id: user.id,
        tax_entity_id: taxEntityId,
        transaction_id: transaction.id,
        tax_amount: Math.abs(Number(transaction.amount ?? 0)),
        tax_date: transaction.date,
        category_id: transaction.category_id ?? null,
        business_percentage: 100,
        deduction_percentage: 100,
        is_tax_deductible: true,
        tax_notes: `Auto-assigned by account: ${data.name ?? "assigned account"}`,
      }));

      for (let i = 0; i < rows.length; i += chunkSize) {
        const batch = rows.slice(i, i + chunkSize);
        const { error: assignError } = await (supabase as any)
          .from("books_tax_transaction_views")
          .upsert(batch, { onConflict: "tax_entity_id,transaction_id", ignoreDuplicates: false });

        if (assignError) throw new Error(assignError.message);
        assignedTransactionCount += batch.length;
      }
    }
  }

  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
  revalidatePath("/books/tax");
  return {
    ...(data as BooksAccount),
    assigned_transaction_count: assignedTransactionCount,
    unassigned_transaction_count: taxEntityId ? 0 : unassignedTransactionCount,
  };
}

// ─── Financial Account CRUD ────────────────────────────────────────────────

export async function listAccounts(taxEntityId?: string): Promise<BooksAccount[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  if (taxEntityId) assertTaxTestingAccess(user);

  let q = (supabase as any)
    .from("books_financial_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true);
  
  if (taxEntityId) {
    q = q.eq("tax_entity_id", taxEntityId);
  }

  const { data, error } = await q.order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as BooksAccount[];
}

export async function createAccount(
  input: Omit<BooksAccount, "id" | "user_id" | "is_active" | "created_at" | "updated_at">
) {
  const { canUseTax } = await getTaxModuleAccess();
  if (!canUseTax && input.tax_entity_id) throw new Error("Tax module is not available");

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  if (input.tax_entity_id) assertTaxTestingAccess(user);

  let udaId = input.uda_id ?? null;
  if (!udaId) {
    const { data: existingUda, error: existingUdaError } = await (supabase as any)
      .from("books_udas")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "Manual Accounts")
      .maybeSingle();

    if (existingUdaError) throw new Error(existingUdaError.message);
    udaId = existingUda?.id ?? null;

    if (!udaId) {
      const { data: createdUda, error: createdUdaError } = await (supabase as any)
        .from("books_udas")
        .insert({
          user_id: user.id,
          name: "Manual Accounts",
          description: "Default group for manually created accounts",
        })
        .select("id")
        .single();

      if (createdUdaError) throw new Error(createdUdaError.message);
      udaId = createdUda.id;
    }
  }

  const row = {
    uda_id: udaId,
    tax_entity_id: input.tax_entity_id ?? null,
    name: input.name,
    account_type: input.account_type ?? "other",
    institution_name: input.institution_name ?? input.institution ?? null,
    last_four_digits: input.last_four_digits ?? null,
    account_identifier: (input as any).account_identifier ?? null,
    current_balance: input.current_balance ?? 0,
    // Null currency stays unknown; a manual account may explicitly confirm USD.
    currency_code: input.currency_code ?? null,
    // A balance provided at creation is an explicit save; otherwise unknown.
    balance_as_of: input.current_balance != null ? new Date().toISOString() : null,
    user_id: user.id,
    is_active: true,
  };

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
  return data as BooksAccount;
}

export async function updateAccount(
  id: string,
  input: Partial<BooksAccount> & {
    cashflow_include?: boolean | null;
    cashflow_role?: string | null;
    is_emergency?: boolean;
    currency_code?: string | null;
  }
) {
  const { canUseTax } = await getTaxModuleAccess();
  if (!canUseTax && input.tax_entity_id) throw new Error("Tax module is not available");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  if (Object.prototype.hasOwnProperty.call(input, "tax_entity_id")) assertTaxTestingAccess(user);

  // Strict field validation (step 4): no client-supplied shape is trusted.
  if ("cashflow_include" in input && input.cashflow_include !== null && typeof input.cashflow_include !== "boolean") {
    throw new Error("Invalid inclusion");
  }
  const ACCOUNT_ROLES = ["spending_source", "reserve", "credit_liability", "investment", "loan", "ignore"];
  if ("cashflow_role" in input && input.cashflow_role !== null && !ACCOUNT_ROLES.includes(input.cashflow_role as string)) {
    throw new Error("Invalid role");
  }
  if ("currency_code" in input && input.currency_code !== null && !/^[A-Z]{3}$/.test(String(input.currency_code))) {
    throw new Error("Invalid currency");
  }

  // Emergency designation requires an explicitly persisted reserve role; a
  // guessed default must never make a spending account an emergency reserve.
  if ((input as { is_emergency?: boolean }).is_emergency === true) {
    const { data: existing } = await (supabase as any)
      .from("books_financial_accounts")
      .select("cashflow_role")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.cashflow_role !== "reserve") {
      throw new Error("Emergency reserve requires a reserve account");
    }
  }

  const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
  // balance_as_of only moves on an actual explicit balance save.
  if (Object.prototype.hasOwnProperty.call(input, "current_balance")) {
    patch.balance_as_of = new Date().toISOString();
  }

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
  return data as BooksAccount;
}

export async function deleteAccount(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await (supabase as any)
    .from("books_financial_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
}

// ─── Backward Compatibility: UDA Functions ─────────────────────────────────
// DEPRECATED: These functions are kept for backward compatibility
// UDAs are being replaced by Tax Entities

export async function listUdas(entityId?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  let q = (supabase as any)
    .from("books_udas")
    .select("*, books_financial_accounts(*)")
    .eq("user_id", user.id);
  if (entityId) q = q.eq("entity_id", entityId);

  const { data, error } = await q.order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as (BooksUda & { books_financial_accounts?: BooksAccount[] })[];
}

export async function createUda(input: { entityId: string; name: string; description?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  if (input.entityId) assertTaxTestingAccess(user);

  const { data, error } = await supabase
    .from("books_udas")
    .insert({ entity_id: input.entityId, user_id: user.id, name: input.name, description: input.description })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
  return data;
}

export async function deleteUda(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase.from("books_udas").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
}

export async function backfillAssignedAccountTaxViews(): Promise<{ accounts: number; transactions: number }> {
  await requireTaxModuleAccess();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  assertTaxTestingAccess(user);

  const { data: accounts, error: accountError } = await (supabase as any)
    .from("books_financial_accounts")
    .select("id, name, tax_entity_id")
    .eq("user_id", user.id)
    .not("tax_entity_id", "is", null);

  if (accountError) throw new Error(accountError.message);

  let accountCount = 0;
  let transactionCount = 0;
  const pageSize = 1000;
  const chunkSize = 500;

  for (const account of accounts ?? []) {
    const accountTransactions: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data: page, error: transactionError } = await (supabase as any)
        .from("books_transactions")
        .select("id, amount, date, category_id")
        .eq("user_id", user.id)
        .eq("financial_account_id", account.id)
        .order("date", { ascending: false })
        .range(from, from + pageSize - 1);

      if (transactionError) throw new Error(transactionError.message);
      accountTransactions.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
    }

    if (accountTransactions.length === 0) continue;

    const rows = accountTransactions.map((transaction: any) => ({
      user_id: user.id,
      tax_entity_id: account.tax_entity_id,
      transaction_id: transaction.id,
      tax_amount: Math.abs(Number(transaction.amount ?? 0)),
      tax_date: transaction.date,
      category_id: transaction.category_id ?? null,
      business_percentage: 100,
      deduction_percentage: 100,
      is_tax_deductible: true,
      tax_notes: `Auto-assigned by account: ${account.name ?? "assigned account"}`,
    }));

    for (let i = 0; i < rows.length; i += chunkSize) {
      const batch = rows.slice(i, i + chunkSize);
      const { error: assignError } = await (supabase as any)
        .from("books_tax_transaction_views")
        .upsert(batch, { onConflict: "tax_entity_id,transaction_id", ignoreDuplicates: false });

      if (assignError) throw new Error(assignError.message);
      transactionCount += batch.length;
    }

    accountCount++;
  }

  return { accounts: accountCount, transactions: transactionCount };
}

export async function mergeFinancialAccounts(params: {
  keepAccountId: string;
  mergeAccountId: string;
  useMergedAccountName?: boolean;
}): Promise<{ movedTransactions: number; deletedAccountId: string }> {
  if (params.keepAccountId === params.mergeAccountId) {
    throw new Error("Choose two different accounts to merge");
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: accounts, error: accountError } = await (supabase as any)
    .from("books_financial_accounts")
    .select("*")
    .eq("user_id", user.id)
    .in("id", [params.keepAccountId, params.mergeAccountId]);

  if (accountError) throw new Error(accountError.message);

  const keep = (accounts ?? []).find((account: any) => account.id === params.keepAccountId);
  const merge = (accounts ?? []).find((account: any) => account.id === params.mergeAccountId);
  if (!keep || !merge) throw new Error("Account not found");

  const { count, error: countError } = await (supabase as any)
    .from("books_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("financial_account_id", params.mergeAccountId);

  if (countError) throw new Error(countError.message);

  const { error: moveError } = await (supabase as any)
    .from("books_transactions")
    .update({ financial_account_id: params.keepAccountId, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("financial_account_id", params.mergeAccountId);

  if (moveError) throw new Error(moveError.message);

  const keepUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (params.useMergedAccountName) keepUpdates.name = merge.name;
  if (!keep.tax_entity_id && merge.tax_entity_id) keepUpdates.tax_entity_id = merge.tax_entity_id;
  if (!keep.institution_name && merge.institution_name) keepUpdates.institution_name = merge.institution_name;
  if (!keep.institution && merge.institution) keepUpdates.institution = merge.institution;
  if (!keep.last_four_digits && merge.last_four_digits) keepUpdates.last_four_digits = merge.last_four_digits;

  const { error: updateError } = await (supabase as any)
    .from("books_financial_accounts")
    .update(keepUpdates)
    .eq("id", params.keepAccountId)
    .eq("user_id", user.id);

  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await (supabase as any)
    .from("books_financial_accounts")
    .delete()
    .eq("id", params.mergeAccountId)
    .eq("user_id", user.id);

  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/books/accounts");
  revalidateConsumerPaths();
  revalidatePath("/books/transactions");
  revalidatePath("/books/tax");

  return { movedTransactions: count ?? 0, deletedAccountId: params.mergeAccountId };
}
