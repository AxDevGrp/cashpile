"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { TaxEntity } from "../types";

// ─── Tax Entity CRUD ───────────────────────────────────────────────────────
// Tax Entities represent businesses, LLCs, rental properties, etc. for tax reporting.
// Financial accounts can be linked to Tax Entities.

export async function listTaxEntities(): Promise<TaxEntity[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_business_entities")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as TaxEntity[];
}

export async function getTaxEntity(id: string): Promise<TaxEntity | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_business_entities")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data as TaxEntity;
}

export async function createTaxEntity(
  input: Omit<TaxEntity, "id" | "user_id" | "created_at" | "updated_at">
): Promise<TaxEntity> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_business_entities")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/tax");
  revalidatePath("/books/accounts");
  return data as TaxEntity;
}

export async function updateTaxEntity(
  id: string, 
  input: Partial<Omit<TaxEntity, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<TaxEntity> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_business_entities")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/tax");
  revalidatePath("/books/accounts");
  return data as TaxEntity;
}

export async function deleteTaxEntity(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await (supabase as any)
    .from("books_business_entities")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/books/tax");
  revalidatePath("/books/accounts");
}

// ─── Backward Compatibility ─────────────────────────────────────────────────
// DEPRECATED: These functions are kept for backward compatibility
// Use the TaxEntity functions above instead

export async function listEntities() {
  return listTaxEntities();
}

export async function createEntity(
  input: Omit<TaxEntity, "id" | "user_id" | "created_at" | "updated_at">
) {
  return createTaxEntity(input);
}

export async function updateEntity(id: string, input: Partial<TaxEntity>) {
  return updateTaxEntity(id, input);
}

export async function deleteEntity(id: string) {
  return deleteTaxEntity(id);
}
