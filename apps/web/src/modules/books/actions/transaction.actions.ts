"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { BooksTransaction } from "../types";

export async function listTransactions(params: {
  taxEntityId?: string; // NEW: Filter by Tax Entity
  udaId?: string; // DEPRECATED: Use taxEntityId instead
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  // Support both new taxEntityId and deprecated udaId
  const entityId = params.taxEntityId ?? params.udaId;

  // If filtering by Tax Entity, resolve its account IDs first
  let accountIds: string[] | undefined;
  if (entityId) {
    const { data: accounts } = await (supabase as any)
      .from("books_financial_accounts")
      .select("id")
      .eq("tax_entity_id", entityId);
    accountIds = (accounts ?? []).map((a: any) => a.id);
    if (accountIds!.length === 0) return { data: [], count: 0 };
  }

  let q = supabase
    .from("books_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (accountIds) q = (q as any).in("financial_account_id", accountIds);
  if (params.accountId) q = (q as any).eq("financial_account_id", params.accountId);
  if (params.categoryId) q = q.eq("category_id", params.categoryId);
  if (params.dateFrom) q = q.gte("date", params.dateFrom);
  if (params.dateTo) q = q.lte("date", params.dateTo);
  if (params.limit) q = q.limit(params.limit);
  if (params.offset) q = q.range(params.offset, params.offset + (params.limit ?? 50) - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return { data: [], count: count ?? 0 };

  const categoryIds = Array.from(
    new Set(rows.map((row: any) => row.category_id).filter(Boolean))
  );
  const financialAccountIds = Array.from(
    new Set(rows.map((row: any) => row.financial_account_id).filter(Boolean))
  );
  const transactionIds = rows.map((row: any) => row.id);

  const [categoriesRes, accountsRes, taxViewsRes] = await Promise.all([
    categoryIds.length > 0
      ? supabase
          .from("books_categories")
          .select("id, name, category_type")
          .eq("user_id", user.id)
          .in("id", categoryIds as any)
      : Promise.resolve({ data: [], error: null }),
    financialAccountIds.length > 0
      ? (supabase as any)
          .from("books_financial_accounts")
          .select("id, name, tax_entity_id")
          .eq("user_id", user.id)
          .in("id", financialAccountIds)
      : Promise.resolve({ data: [], error: null }),
    (supabase as any)
      .from("books_tax_transaction_views")
      .select("transaction_id, tax_entity_id, tax_notes, business_percentage")
      .eq("user_id", user.id)
      .in("transaction_id", transactionIds),
  ]);

  if (categoriesRes.error) {
    console.error("[books/transactions] category hydration failed:", categoriesRes.error.message);
  }
  if (accountsRes.error) {
    console.error("[books/transactions] account hydration failed:", accountsRes.error.message);
  }
  if (taxViewsRes.error) {
    console.error("[books/transactions] tax view hydration failed:", taxViewsRes.error.message);
  }

  const categoriesById = new Map(
    (categoriesRes.error ? [] : categoriesRes.data ?? []).map((category: any) => [category.id, category])
  );
  const accountsById = new Map(
    (accountsRes.error ? [] : accountsRes.data ?? []).map((account: any) => [account.id, account])
  );
  const taxViewsByTransactionId = new Map<string, any[]>();
  for (const view of taxViewsRes.error ? [] : taxViewsRes.data ?? []) {
    const list = taxViewsByTransactionId.get(view.transaction_id) ?? [];
    list.push(view);
    taxViewsByTransactionId.set(view.transaction_id, list);
  }

  return {
    data: rows.map((row: any) => ({
      ...row,
      type: row.type ?? row.transaction_type,
      account_id: row.account_id ?? row.financial_account_id,
      books_categories: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
      books_financial_accounts: row.financial_account_id
        ? accountsById.get(row.financial_account_id) ?? null
        : null,
      books_tax_transaction_views: taxViewsByTransactionId.get(row.id) ?? [],
    })),
    count: count ?? 0,
  };
}

export async function createTransaction(input: Omit<BooksTransaction, "id" | "user_id" | "created_at" | "updated_at">) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_transactions")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/transactions");
  return data;
}

export async function updateTransaction(id: string, input: Partial<BooksTransaction>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_transactions")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/transactions");
  return data;
}

export async function deleteTransaction(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("books_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/books/transactions");
}

export async function bulkUpdateTransactions(
  ids: string[],
  input: Pick<Partial<BooksTransaction>, "category_id" | "is_transfer" | "notes">
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("books_transactions")
    .update({ ...input, updated_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/books/transactions");
}
