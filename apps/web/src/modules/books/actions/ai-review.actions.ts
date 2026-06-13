"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import { categorizeTransactions as aiCategorizeTransactions } from "@cashpile/ai";
import { createCategoryRule } from "./category-rule.actions";
import { assignTransactions, createTaxAssignmentRule } from "./tax.actions";
import { updateAccount } from "./account.actions";

function normalizePattern(value: string | null | undefined) {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\b(INC|LLC|LTD|CO|CORP|CORPORATION|PAYMENT|PURCHASE|POS|DEBIT|CARD|ONLINE|WEB|ID|PPD|ACH|CCD)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function derivePattern(merchant: string | null | undefined, description: string | null | undefined) {
  const merchantPattern = normalizePattern(merchant);
  if (merchantPattern) return merchantPattern;

  const tokens = normalizePattern(description)
    .split(" ")
    .filter((token) => token.length > 1 && !/^\d+$/.test(token) && !/^[A-Z]*\d[A-Z0-9]*$/.test(token));
  return tokens.slice(0, 3).join(" ");
}

function categoryTypeFromAmount(amount: number) {
  return amount > 0 ? "income" : "expense";
}

function defaultCategoryNameForPattern(pattern: string, amount: number) {
  const text = pattern.toUpperCase();
  if (/PAYROLL|SALARY|WAGES|DIRECT DEPOSIT|OASISBATCH/.test(text)) return "Income";
  if (/TRANSFER|ZELLE|VENMO|CASH APP|COINBASE|WIRE/.test(text)) return "Transfers";
  if (/MORTGAGE|LOAN/.test(text)) return "Mortgage Payments";
  if (/HOME DEPOT|LOWES|PLUMB|HVAC|REPAIR|MAINTENANCE|HANDYMAN|PEST|CLEAN/.test(text)) return "Cleaning and Maintenance";
  if (/FPL|ELECTRIC|WATER|COMCAST|XFINITY|VERIZON|UTILITY/.test(text)) return "Utilities";
  if (/INSURANCE|GEICO|PROGRESSIVE|STATE FARM/.test(text)) return "Insurance";
  if (/ANTHROPIC|OPENAI|CHATGPT|CLAUDE|GITHUB|ADOBE|MICROSOFT|GOOGLE/.test(text)) return "Software & Subscriptions";
  if (/RESTAURANT|CAFE|STARBUCKS|DOORDASH|UBER EATS|GRUBHUB/.test(text)) return "Meals & Dining";
  return amount > 0 ? "Income" : "Other";
}

export interface AiReviewSuggestion {
  id: string;
  pattern: string;
  accountId: string | null;
  accountName: string;
  accountLabel: string;
  transactionIds: string[];
  count: number;
  totalAmount: number;
  firstDate: string | null;
  lastDate: string | null;
  suggestedTaxEntityId: string | null;
  suggestedTaxEntityName: string | null;
  suggestedCategoryId: string | number | null;
  suggestedCategoryName: string | null;
  confidence: number;
  reason: string;
  examples: Array<{ id: string; date: string; description: string; merchant: string | null; amount: number }>;
}

export async function listAiReviewSuggestions(limit = 40): Promise<{
  suggestions: AiReviewSuggestion[];
  categories: any[];
  taxEntities: any[];
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const [{ data: transactions, error: txError }, { data: categories, error: categoryError }, { data: taxEntities, error: entityError }] = await Promise.all([
    (supabase as any)
      .from("books_transactions")
      .select("id, date, description, merchant, amount, category_id, financial_account_id, books_financial_accounts(id, name, institution_name, last_four_digits, tax_entity_id)")
      .eq("user_id", user.id)
      .eq("is_transfer", false)
      .order("date", { ascending: false })
      .limit(5000),
    (supabase as any)
      .from("books_categories")
      .select("id, name, category_type, parent_category_id")
      .eq("user_id", user.id)
      .order("name"),
    (supabase as any)
      .from("books_business_entities")
      .select("id, name, entity_type")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (txError) throw new Error(txError.message);
  if (categoryError) throw new Error(categoryError.message);
  if (entityError) throw new Error(entityError.message);

  const taxEntityById = new Map<string, any>((taxEntities ?? []).map((entity: any) => [String(entity.id), entity]));
  const categoryByName = new Map<string, any>((categories ?? []).map((category: any) => [String(category.name).toLowerCase(), category]));

  const transactionIds = (transactions ?? []).map((tx: any) => tx.id);
  const existingTaxViews = transactionIds.length > 0
    ? await (supabase as any)
      .from("books_tax_transaction_views")
      .select("transaction_id")
      .eq("user_id", user.id)
      .in("transaction_id", transactionIds)
    : { data: [] };

  const taxAssignedIds = new Set((existingTaxViews.data ?? []).map((row: any) => String(row.transaction_id)));
  const groups = new Map<string, any[]>();

  for (const tx of transactions ?? []) {
    if (tx.category_id && taxAssignedIds.has(String(tx.id))) continue;
    const pattern = derivePattern(tx.merchant, tx.description);
    if (!pattern || pattern.length < 3) continue;
    const accountId = tx.financial_account_id ?? "no-account";
    const key = `${accountId}|${pattern}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const suggestions: AiReviewSuggestion[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    const [accountId, pattern] = key.split("|");
    const rawAccount = rows[0].books_financial_accounts;
    const account = (Array.isArray(rawAccount) ? rawAccount[0] : rawAccount) as any;
    const totalAmount = rows.reduce((sum: number, tx: any) => sum + Number(tx.amount ?? 0), 0);
    const representative = rows[0];
    const defaultCategoryName = defaultCategoryNameForPattern(pattern, Number(representative.amount ?? 0));
    let category = categoryByName.get(defaultCategoryName.toLowerCase()) ?? null;
    let confidence = account?.tax_entity_id ? 0.92 : 0.78;
    let reason = account?.tax_entity_id
      ? `Grouped by account and merchant/description pattern. Account is assigned to ${taxEntityById.get(String(account.tax_entity_id))?.name ?? "a Tax Entity"}.`
      : "Grouped by repeated merchant/description pattern. Needs Tax Entity confirmation.";

    if (!category && categories?.length) {
      try {
        const aiResults = await aiCategorizeTransactions([
          {
            id: representative.id,
            description: representative.description,
            merchant: representative.merchant ?? undefined,
            amount: Number(representative.amount ?? 0),
            type: categoryTypeFromAmount(Number(representative.amount ?? 0)),
          },
        ], categories.map((item: any) => ({ id: Number(item.id), name: item.name })));
        const aiResult = aiResults[0];
        if (aiResult?.confidence >= 0.7) {
          category = categoryByName.get(aiResult.categoryName.toLowerCase()) ?? null;
          confidence = Math.max(confidence, Math.min(aiResult.confidence, 0.9));
          reason += ` AI suggested ${aiResult.categoryName}.`;
        }
      } catch {
        // AI is best-effort for the review queue; deterministic grouping still works without it.
      }
    }

    suggestions.push({
      id: Buffer.from(key).toString("base64url"),
      pattern,
      accountId: accountId === "no-account" ? null : accountId,
      accountName: account?.name ?? "No account",
      accountLabel: `${account?.name ?? "No account"}${account?.last_four_digits ? ` - *${account.last_four_digits}` : ""}`,
      transactionIds: rows.map((tx: any) => tx.id),
      count: rows.length,
      totalAmount,
      firstDate: rows[rows.length - 1]?.date ?? null,
      lastDate: rows[0]?.date ?? null,
      suggestedTaxEntityId: account?.tax_entity_id ?? null,
      suggestedTaxEntityName: account?.tax_entity_id ? taxEntityById.get(String(account.tax_entity_id))?.name ?? null : null,
      suggestedCategoryId: category?.id ?? null,
      suggestedCategoryName: category?.name ?? null,
      confidence,
      reason,
      examples: rows.slice(0, 5).map((tx: any) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant ?? null,
        amount: Number(tx.amount ?? 0),
      })),
    });
  }

  return {
    suggestions: suggestions
      .sort((a, b) => (b.confidence - a.confidence) || (b.count - a.count))
      .slice(0, limit),
    categories: categories ?? [],
    taxEntities: taxEntities ?? [],
  };
}

export async function acceptAiReviewSuggestion(input: {
  transactionIds: string[];
  pattern: string;
  accountId?: string | null;
  categoryId?: string | number | null;
  taxEntityId?: string | null;
  applyAccountDefault?: boolean;
  createRule?: boolean;
}): Promise<{ updatedTransactions: number; assignedTaxViews: number; categoryRuleCreated: boolean; taxRuleCreated: boolean; accountRuleUpdated: boolean }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const transactionIds = [...new Set(input.transactionIds)].filter(Boolean);
  if (transactionIds.length === 0) throw new Error("No transactions selected");
  if (!input.categoryId && !input.taxEntityId) throw new Error("Choose a category, Tax Entity, or both");

  let updatedTransactions = 0;
  if (input.categoryId) {
    const { error } = await (supabase as any)
      .from("books_transactions")
      .update({
        category_id: Number(input.categoryId),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .in("id", transactionIds);
    if (error) throw new Error(error.message);
    updatedTransactions = transactionIds.length;
  }

  let assignedTaxViews = 0;
  if (input.taxEntityId) {
    const result = await assignTransactions({
      transactionIds,
      taxEntityId: input.taxEntityId,
      categoryId: input.categoryId ? Number(input.categoryId) : undefined,
      isDeductible: true,
      notes: `AI-confirmed rule: ${input.pattern}`,
    });
    assignedTaxViews = result.assigned;
  }

  let categoryRuleCreated = false;
  let taxRuleCreated = false;
  let accountRuleUpdated = false;
  if (input.createRule !== false) {
    if (input.categoryId) {
      await createCategoryRule({ pattern: input.pattern, categoryId: input.categoryId, source: "manual", priority: input.accountId ? 100 : 80 });
      categoryRuleCreated = true;
    }
    if (input.taxEntityId) {
      await createTaxAssignmentRule({ pattern: input.pattern, match_type: "contains", tax_entity_id: input.taxEntityId, priority: input.accountId ? 100 : 80 });
      taxRuleCreated = true;
    }
  }

  if (input.applyAccountDefault && input.accountId && input.taxEntityId) {
    await updateAccount(input.accountId, { tax_entity_id: input.taxEntityId } as any);
    accountRuleUpdated = true;
  }

  revalidatePath("/books/transactions");
  revalidatePath("/books/transactions/ai-review");
  revalidatePath("/books/tax");
  return { updatedTransactions, assignedTaxViews, categoryRuleCreated, taxRuleCreated, accountRuleUpdated };
}
