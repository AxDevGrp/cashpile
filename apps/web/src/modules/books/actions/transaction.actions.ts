"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { BooksTransaction } from "../types";

export async function listTransactions(params: {
  entityId?: string;
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

  let q = supabase
    .from("books_transactions")
    .select(`*, books_categories(id, name, category_type), books_financial_accounts(id, name)`, { count: "exact" })
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (params.accountId) q = q.eq("financial_account_id", params.accountId);
  if (params.categoryId) q = q.eq("category_id", params.categoryId);
  if (params.dateFrom) q = q.gte("date", params.dateFrom);
  if (params.dateTo) q = q.lte("date", params.dateTo);
  if (params.limit) q = q.limit(params.limit);
  if (params.offset) q = q.range(params.offset, params.offset + (params.limit ?? 50) - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0 };
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
