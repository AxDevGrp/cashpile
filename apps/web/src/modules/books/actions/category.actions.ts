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
  input: Partial<Omit<BooksCategory, "id" | "user_id" | "created_at">> & { name: string }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const row = {
    name: input.name.trim(),
    description: input.description ?? null,
    category_type: input.category_type ?? input.type ?? "expense",
    parent_category_id: input.parent_category_id ?? input.parent_id ?? null,
    is_tax_deductible: input.is_tax_deductible ?? false,
    color: input.color ?? "#6B7280",
    icon: input.icon ?? "folder",
    user_id: user.id,
  };

  const { data, error } = await (supabase as any)
    .from("books_categories")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books");
  revalidatePath("/books/transactions");
  revalidatePath("/books/category-rules");
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

const DEFAULT_BOOK_CATEGORIES = [
  { name: "Software & Subscriptions", category_type: "expense", is_tax_deductible: true },
  { name: "Cloud & Hosting", category_type: "expense", is_tax_deductible: true },
  { name: "Meals & Dining", category_type: "expense", is_tax_deductible: true },
  { name: "Groceries", category_type: "expense", is_tax_deductible: false },
  { name: "Transportation", category_type: "expense", is_tax_deductible: false },
  { name: "Travel", category_type: "expense", is_tax_deductible: true },
  { name: "Shopping", category_type: "expense", is_tax_deductible: false },
  { name: "Utilities", category_type: "expense", is_tax_deductible: false },
  { name: "Mortgage Payments", category_type: "expense", is_tax_deductible: false },
  { name: "Rent", category_type: "expense", is_tax_deductible: false },
  { name: "Property Taxes", category_type: "expense", is_tax_deductible: true },
  { name: "Home Insurance", category_type: "expense", is_tax_deductible: false },
  { name: "Car Insurance", category_type: "expense", is_tax_deductible: false },
  { name: "Insurance", category_type: "expense", is_tax_deductible: false },
  { name: "HOA Fees", category_type: "expense", is_tax_deductible: false },
  { name: "Cleaning and Maintenance", category_type: "expense", is_tax_deductible: true },
  { name: "Healthcare", category_type: "expense", is_tax_deductible: false },
  { name: "Dental", category_type: "expense", is_tax_deductible: false },
  { name: "Entertainment", category_type: "expense", is_tax_deductible: false },
  { name: "Bank Fees", category_type: "expense", is_tax_deductible: true },
  { name: "Income", category_type: "income", is_tax_deductible: false },
  { name: "Transfers", category_type: "transfer", is_tax_deductible: false },
  { name: "Other", category_type: "expense", is_tax_deductible: false },
];

export async function ensureDefaultBookCategories() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: existing, error: existingError } = await (supabase as any)
    .from("books_categories")
    .select("name")
    .eq("user_id", user.id);

  if (existingError) throw new Error(existingError.message);

  const existingNames = new Set((existing ?? []).map((category: any) => String(category.name).toLowerCase()));
  const missing = DEFAULT_BOOK_CATEGORIES
    .filter((category) => !existingNames.has(category.name.toLowerCase()))
    .map((category) => ({ ...category, user_id: user.id }));

  if (missing.length > 0) {
    const { error } = await (supabase as any)
      .from("books_categories")
      .insert(missing);
    if (error) throw new Error(error.message);
    revalidatePath("/books");
    revalidatePath("/books/category-rules");
    revalidatePath("/books/transactions");
  }

  return { created: missing.length };
}
