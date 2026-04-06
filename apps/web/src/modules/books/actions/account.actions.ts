"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { BooksUda, BooksAccount, TaxEntity } from "../types";

// ─── Tax Entity Account Management ─────────────────────────────────────────
// Financial accounts can optionally be linked to Tax Entities

export async function getAccountsByTaxEntity(taxEntityId: string): Promise<BooksAccount[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .select(`*, tax_entity:books_business_entities(*)`)
    .eq("tax_entity_id", taxEntityId)
    .eq("user_id", user.id)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as BooksAccount[];
}

export async function assignAccountToTaxEntity(
  accountId: string, 
  taxEntityId: string | null
): Promise<BooksAccount> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

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
  revalidatePath("/books/accounts");
  revalidatePath("/books/tax");
  return data as BooksAccount;
}

// ─── Financial Account CRUD ────────────────────────────────────────────────

export async function listAccounts(taxEntityId?: string): Promise<BooksAccount[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  let q = (supabase as any)
    .from("books_financial_accounts")
    .select(`*, tax_entity:books_business_entities(*)`)
    .eq("user_id", user.id);
  
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
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .insert({ ...input, user_id: user.id, is_active: true })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
  return data as BooksAccount;
}

export async function updateAccount(id: string, input: Partial<BooksAccount>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/accounts");
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
