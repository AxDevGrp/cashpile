"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import { ensureDefaultBookCategories } from "./category.actions";
import { SYSTEM_CATEGORY_RULES } from "../services/system-category-rules";

export interface BooksCategoryRule {
  id: string;
  user_id: string;
  pattern: string;
  match_type: "contains" | "equals";
  category_id: number;
  is_active: boolean;
  priority: number;
  source: "manual" | "learned" | "system";
  match_count: number;
  last_matched_at?: string | null;
  created_at: string;
  updated_at: string;
  books_categories?: { id: number; name: string } | null;
}

function normalizePattern(value: string | null | undefined) {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\b(INC|LLC|LTD|CO|CORP|CORPORATION|PAYMENT|PURCHASE|POS|DEBIT|CARD|ONLINE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function seedSystemCategoryRules() {
  await ensureDefaultBookCategories();

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: categories, error: categoriesError } = await (supabase as any)
    .from("books_categories")
    .select("id, name")
    .eq("user_id", user.id);

  if (categoriesError) throw new Error(categoriesError.message);

  const categoryByName = new Map((categories ?? []).map((category: any) => [String(category.name), category.id]));
  const rows = SYSTEM_CATEGORY_RULES
    .map((rule) => {
      const categoryId = categoryByName.get(rule.categoryName);
      if (!categoryId) return null;
      return {
        user_id: user.id,
        pattern: normalizePattern(rule.pattern),
        category_id: categoryId,
        match_type: "contains",
        source: "system",
        priority: rule.priority,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return { seeded: 0 };

  const { error } = await (supabase as any)
    .from("books_category_rules")
    .upsert(rows, { onConflict: "user_id,pattern", ignoreDuplicates: true });

  if (error) {
    if (error.message?.includes("books_category_rules")) return { seeded: 0 };
    throw new Error(error.message);
  }

  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
  return { seeded: rows.length };
}

export async function listCategoryRules(): Promise<BooksCategoryRule[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await (supabase as any)
    .from("books_category_rules")
    .select("*, books_categories(id, name)")
    .eq("user_id", user.id)
    .order("priority", { ascending: false })
    .order("pattern");

  if (error) {
    if (error.message?.includes("books_category_rules")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as BooksCategoryRule[];
}

export async function createCategoryRule(input: {
  pattern: string;
  categoryId: number | string;
  matchType?: "contains" | "equals";
  source?: "manual" | "learned" | "system";
  priority?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const pattern = normalizePattern(input.pattern);
  if (!pattern) throw new Error("Rule pattern is required");

  const row = {
    user_id: user.id,
    pattern,
    category_id: Number(input.categoryId),
    match_type: input.matchType ?? "contains",
    source: input.source ?? "manual",
    priority: input.priority ?? 0,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("books_category_rules")
    .upsert(row, { onConflict: "user_id,pattern" })
    .select("*, books_categories(id, name)")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
  return data as BooksCategoryRule;
}

export async function updateCategoryRule(id: string, input: Partial<{
  pattern: string;
  categoryId: number | string;
  matchType: "contains" | "equals";
  isActive: boolean;
  priority: number;
}>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.pattern !== undefined) update.pattern = normalizePattern(input.pattern);
  if (input.categoryId !== undefined) update.category_id = Number(input.categoryId);
  if (input.matchType !== undefined) update.match_type = input.matchType;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  if (input.priority !== undefined) update.priority = input.priority;

  const { data, error } = await (supabase as any)
    .from("books_category_rules")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, books_categories(id, name)")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
  return data as BooksCategoryRule;
}

export async function deleteCategoryRule(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await (supabase as any)
    .from("books_category_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
}

export async function learnCategoryRuleFromTransaction(transactionId: string, categoryId: number | string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: tx, error } = await (supabase as any)
    .from("books_transactions")
    .select("merchant, description")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();

  if (error) throw new Error(error.message);
  const pattern = normalizePattern(tx?.merchant) || normalizePattern(tx?.description);
  if (!pattern) return null;
  return createCategoryRule({ pattern, categoryId, source: "learned" });
}

export async function applyCategoryRuleToUncategorizedTransactions(ruleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: rule, error: ruleError } = await (supabase as any)
    .from("books_category_rules")
    .select("id, pattern, match_type, category_id, match_count")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (ruleError) throw new Error(ruleError.message);

  const pattern = normalizePattern(rule?.pattern);
  if (!pattern) return { applied: 0 };

  const { data: candidates, error: candidateError } = await (supabase as any)
    .from("books_transactions")
    .select("id, merchant, description")
    .eq("user_id", user.id)
    .is("category_id", null)
    .eq("is_transfer", false)
    .limit(10000);

  if (candidateError) throw new Error(candidateError.message);

  const matchingIds = (candidates ?? [])
    .filter((tx: any) => {
      const normalized = normalizePattern(tx.merchant) || normalizePattern(tx.description);
      return rule.match_type === "equals" ? normalized === pattern : normalized.includes(pattern);
    })
    .map((tx: any) => tx.id);

  if (matchingIds.length === 0) return { applied: 0 };

  const now = new Date().toISOString();
  let applied = 0;
  const chunkSize = 500;
  for (let i = 0; i < matchingIds.length; i += chunkSize) {
    const ids = matchingIds.slice(i, i + chunkSize);
    const { error } = await (supabase as any)
      .from("books_transactions")
      .update({ category_id: rule.category_id, updated_at: now })
      .eq("user_id", user.id)
      .in("id", ids)
      .is("category_id", null);

    if (error) throw new Error(error.message);
    applied += ids.length;
  }

  await (supabase as any)
    .from("books_category_rules")
    .update({ match_count: (rule.match_count ?? 0) + applied, last_matched_at: now, updated_at: now })
    .eq("id", rule.id)
    .eq("user_id", user.id);

  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
  return { applied };
}
