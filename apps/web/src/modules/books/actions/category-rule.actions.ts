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
  financial_account_id?: string | null;
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

function deriveLearnedPattern(merchant: string | null | undefined, description: string | null | undefined) {
  const normalizedMerchant = normalizePattern(merchant);
  if (normalizedMerchant) return normalizedMerchant;

  const normalizedDescription = normalizePattern(description);
  const tokens = normalizedDescription
    .split(" ")
    .filter((token) => (
      token.length > 1 &&
      !/^\d+$/.test(token) &&
      !/^[A-Z]*\d[A-Z0-9]*$/.test(token) &&
      !["ACH", "PPD", "CCD", "WEB", "ID", "POS", "DBT", "CRD", "REF", "TRACE", "TRANSACTION"].includes(token)
    ));

  return tokens.slice(0, 3).join(" ") || normalizedDescription;
}

function transactionSearchValues(tx: { merchant?: string | null; description?: string | null }) {
  return [
    normalizePattern(tx.merchant),
    normalizePattern(tx.description),
    deriveLearnedPattern(tx.merchant, tx.description),
  ].filter(Boolean);
}

function matchesRule(values: string[], pattern: string, matchType: "contains" | "equals") {
  if (matchType === "equals") return values.some((value) => value === pattern);
  const patternTokens = pattern.split(" ").filter(Boolean);
  return values.some((value) => (
    value.includes(pattern) ||
    (patternTokens.length > 0 && patternTokens.every((token) => value.split(" ").includes(token)))
  ));
}

function isMissingAccountScopeColumn(error: any) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("financial_account_id") && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

function accountScopeMigrationError() {
  return new Error("Account-scoped rules require database migration 020_account_scoped_book_rules.sql to be applied.");
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

  const patterns = rows.map((row: any) => row.pattern);
  const { data: existingRows, error: existingError } = await (supabase as any)
    .from("books_category_rules")
    .select("pattern")
    .eq("user_id", user.id)
    .in("pattern", patterns);

  if (existingError) {
    if (existingError.message?.includes("books_category_rules")) return { seeded: 0 };
    throw new Error(existingError.message);
  }

  const existingPatterns = new Set((existingRows ?? []).map((row: any) => row.pattern));
  const missingRows = rows.filter((row: any) => !existingPatterns.has(row.pattern));
  if (missingRows.length === 0) return { seeded: 0 };

  const { error } = await (supabase as any)
    .from("books_category_rules")
    .insert(missingRows);

  if (error) throw new Error(error.message);

  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
  return { seeded: missingRows.length };
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
  accountId?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const pattern = normalizePattern(input.pattern);
  if (!pattern) throw new Error("Rule pattern is required");

  const row = {
    user_id: user.id,
    pattern,
    financial_account_id: input.accountId ?? null,
    category_id: Number(input.categoryId),
    match_type: input.matchType ?? "contains",
    source: input.source ?? "manual",
    priority: input.priority ?? 0,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let existingQuery = (supabase as any)
    .from("books_category_rules")
    .select("*, books_categories(id, name)")
    .eq("user_id", user.id)
    .eq("pattern", pattern);
  existingQuery = input.accountId ? existingQuery.eq("financial_account_id", input.accountId) : existingQuery.is("financial_account_id", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) {
    if (isMissingAccountScopeColumn(existingError)) {
      if (input.accountId) throw accountScopeMigrationError();
      const legacyRow = { ...row } as any;
      delete legacyRow.financial_account_id;
      const { data, error } = await (supabase as any)
        .from("books_category_rules")
        .upsert(legacyRow, { onConflict: "user_id,pattern" })
        .select("*, books_categories(id, name)")
        .single();
      if (error) throw new Error(error.message);
      revalidatePath("/books/category-rules");
      revalidatePath("/books/transactions");
      return data as BooksCategoryRule;
    }
    throw new Error(existingError.message);
  }

  const query = existing
    ? (supabase as any)
      .from("books_category_rules")
      .update(row)
      .eq("id", existing.id)
      .eq("user_id", user.id)
    : (supabase as any)
      .from("books_category_rules")
      .insert(row);

  const { data, error } = await query
    .select("*, books_categories(id, name)")
    .single();

  if (error) {
    if (isMissingAccountScopeColumn(error)) throw accountScopeMigrationError();
    throw new Error(error.message);
  }
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
  accountId: string | null;
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
  if (input.accountId !== undefined) update.financial_account_id = input.accountId;

  const { data, error } = await (supabase as any)
    .from("books_category_rules")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, books_categories(id, name)")
    .single();

  if (error) {
    if (isMissingAccountScopeColumn(error)) {
      if (input.accountId) throw accountScopeMigrationError();
      const { financial_account_id: _ignored, ...legacyUpdate } = update;
      const retry = await (supabase as any)
        .from("books_category_rules")
        .update(legacyUpdate)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*, books_categories(id, name)")
        .single();
      if (retry.error) throw new Error(retry.error.message);
      revalidatePath("/books/category-rules");
      revalidatePath("/books/transactions");
      return retry.data as BooksCategoryRule;
    }
    throw new Error(error.message);
  }
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
    .select("merchant, description, financial_account_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();

  if (error) throw new Error(error.message);
  const pattern = deriveLearnedPattern(tx?.merchant, tx?.description);
  if (!pattern) return null;
  return createCategoryRule({ pattern, categoryId, source: "learned", accountId: tx?.financial_account_id ?? null });
}

export async function applyCategoryRuleToUncategorizedTransactions(ruleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  let ruleQuery = (supabase as any)
    .from("books_category_rules")
    .select("id, pattern, match_type, category_id, match_count, financial_account_id")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .eq("is_active", true);
  let { data: rule, error: ruleError } = await ruleQuery.single();
  if (ruleError && isMissingAccountScopeColumn(ruleError)) {
    const fallback = await (supabase as any)
      .from("books_category_rules")
      .select("id, pattern, match_type, category_id, match_count")
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();
    rule = fallback.data ? { ...fallback.data, financial_account_id: null } : null;
    ruleError = fallback.error;
  }

  if (ruleError) throw new Error(ruleError.message);

  const pattern = normalizePattern(rule?.pattern);
  if (!pattern) return { applied: 0 };

  let candidateQuery = (supabase as any)
    .from("books_transactions")
    .select("id, merchant, description, amount, date, transaction_type, financial_account_id")
    .eq("user_id", user.id)
    .is("category_id", null)
    .eq("is_transfer", false)
    .limit(10000);
  if (rule.financial_account_id) candidateQuery = candidateQuery.eq("financial_account_id", rule.financial_account_id);

  const { data: candidates, error: candidateError } = await candidateQuery;

  if (candidateError) throw new Error(candidateError.message);

  const matchingTransactions = (candidates ?? [])
    .filter((tx: any) => {
      const values = transactionSearchValues(tx);
      return matchesRule(values, pattern, rule.match_type);
    });
  const matchingIds = matchingTransactions.map((tx: any) => tx.id);

  if (matchingIds.length === 0) return { applied: 0, taxAssigned: 0 };

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

    const { error: taxViewError } = await (supabase as any)
      .from("books_tax_transaction_views")
      .update({ category_id: rule.category_id, updated_at: now })
      .eq("user_id", user.id)
      .in("transaction_id", ids);
    if (taxViewError) console.warn("[category-rules] Failed to sync tax view category:", taxViewError.message);
  }

  await (supabase as any)
    .from("books_category_rules")
    .update({ match_count: (rule.match_count ?? 0) + applied, last_matched_at: now, updated_at: now })
    .eq("id", rule.id)
    .eq("user_id", user.id);

  const { autoAssignTaxEntities } = await import("../services/tax-rule-engine");
  const taxAssigned = await autoAssignTaxEntities(supabase as any, user.id, matchingTransactions.map((tx: any) => ({
    ...tx,
    category_id: rule.category_id,
  })));

  revalidatePath("/books/category-rules");
  revalidatePath("/books/transactions");
  revalidatePath("/books/tax");
  return { applied, taxAssigned };
}
