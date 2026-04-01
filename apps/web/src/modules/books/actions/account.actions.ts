"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { BooksUda, BooksAccount } from "../types";

// ─── UDA CRUD ──────────────────────────────────────────────────────────────

export async function listUdas(entityId?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  let q = supabase.from("books_udas").select("*, books_financial_accounts(*)").eq("user_id", user.id);
  if (entityId) q = q.eq("entity_id", entityId);

  const { data, error } = await q.order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createUda(input: { entityId: string; name: string; description?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_udas")
    .insert({ entity_id: input.entityId, user_id: user.id, name: input.name, description: input.description })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  return data;
}

export async function deleteUda(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase.from("books_udas").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
}

// ─── Financial Account CRUD ────────────────────────────────────────────────

export async function createAccount(
  input: Omit<BooksAccount, "id" | "user_id" | "is_active" | "created_at" | "updated_at">
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_financial_accounts")
    .insert({ ...input, user_id: user.id, is_active: true })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  return data;
}

export async function updateAccount(id: string, input: Partial<BooksAccount>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_financial_accounts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  return data;
}

export async function deleteAccount(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase.from("books_financial_accounts").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
}
