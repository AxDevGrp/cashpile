"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import type { BooksCategory } from "../types";

export async function listCategories(_entityId?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as BooksCategory[];
}

export async function createCategory(
  input: Omit<BooksCategory, "id" | "user_id" | "created_at">
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_categories")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books");
  return data as BooksCategory;
}

export async function updateCategory(id: string, input: Partial<BooksCategory>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("books_categories")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books");
  return data as BooksCategory;
}

export async function deleteCategory(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("books_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/books");
}
