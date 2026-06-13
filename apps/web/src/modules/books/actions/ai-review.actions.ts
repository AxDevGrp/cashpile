"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import { categorizeTransactions as aiCategorizeTransactions, parseBooksInstruction } from "@cashpile/ai";
import { createCategoryRule } from "./category-rule.actions";
import { assignTransactions, createTaxAssignmentRule } from "./tax.actions";
import { assignAccountToTaxEntity } from "./account.actions";

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

function normalizeMention(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMentionedRow<T extends { id: string | number; name: string }>(
  instruction: string,
  rows: T[],
  aliases: (row: T) => string[] = () => []
) {
  const text = normalizeMention(instruction);
  return [...rows]
    .sort((a, b) => b.name.length - a.name.length)
    .find((row) => [row.name, ...aliases(row)]
      .map(normalizeMention)
      .filter((value) => value.length >= 3)
      .some((value) => text.includes(value)));
}

function extractInstructionPattern(instruction: string) {
  const quoted = instruction.match(/["“](.+?)["”]/)?.[1] ?? instruction.match(/'(.+?)'/)?.[1];
  if (quoted) return normalizePattern(quoted);

  const vendor = instruction.match(/\b(?:merchant|vendor|payee|from|at)\s+([A-Za-z0-9 .&'-]{3,50})/i)?.[1];
  if (vendor) return normalizePattern(vendor);

  return "";
}

function buildInstructionOptions(rows: any[], aliases: (row: any) => string[] = () => []) {
  return (rows ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    aliases: aliases(row).filter(Boolean),
  }));
}

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

async function updateCategoryWithAudit(
  supabase: any,
  userId: string,
  transactionIds: string[],
  categoryId: string | number,
  audit: Record<string, unknown>,
  onlyUncategorized = false
) {
  const uniqueIds = [...new Set(transactionIds)].filter(Boolean);
  if (uniqueIds.length === 0) return 0;

  const { data: rows, error: fetchError } = await supabase
    .from("books_transactions")
    .select("id, metadata, category_id")
    .eq("user_id", userId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const now = new Date().toISOString();
  let updated = 0;
  const updatedIds: string[] = [];
  for (const row of rows ?? []) {
    if (onlyUncategorized && row.category_id) continue;
    let query = supabase
      .from("books_transactions")
      .update({
        category_id: Number(categoryId),
        metadata: {
          ...(row.metadata ?? {}),
          category_assignment: {
            ...audit,
            assigned_at: now,
          },
        },
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("id", row.id);
    if (onlyUncategorized) query = query.is("category_id", null);

    const { error } = await query;
    if (error) throw new Error(error.message);
    updated += 1;
    updatedIds.push(row.id);
  }

  if (updatedIds.length > 0) {
    const { error } = await supabase
      .from("books_tax_transaction_views")
      .update({ category_id: Number(categoryId), updated_at: now })
      .eq("user_id", userId)
      .in("transaction_id", updatedIds);
    if (error) console.warn("[ai-review] Failed to sync tax view categories:", error.message);
  }
  return updated;
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

export async function listAiReviewSuggestions(limit = 40, accountId?: string | null): Promise<{
  suggestions: AiReviewSuggestion[];
  categories: any[];
  taxEntities: any[];
  accounts: any[];
  activeAccount: { id: string; name: string; institution_name?: string | null; last_four_digits?: string | null } | null;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  const scopedAccountId = isUuid(accountId) ? accountId : null;

  let transactionQuery = (supabase as any)
    .from("books_transactions")
    .select("id, date, description, merchant, amount, category_id, financial_account_id, metadata, books_financial_accounts(id, name, institution_name, last_four_digits, tax_entity_id)")
    .eq("user_id", user.id)
    .eq("is_transfer", false)
    .order("date", { ascending: false })
    .limit(5000);
  if (scopedAccountId) transactionQuery = transactionQuery.eq("financial_account_id", scopedAccountId);

  const [{ data: transactions, error: txError }, { data: categories, error: categoryError }, { data: taxEntities, error: entityError }, { data: accounts, error: accountError }] = await Promise.all([
    transactionQuery,
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
    (supabase as any)
      .from("books_financial_accounts")
      .select("id, name, institution_name, last_four_digits, tax_entity_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (txError) throw new Error(txError.message);
  if (categoryError) throw new Error(categoryError.message);
  if (entityError) throw new Error(entityError.message);
  if (accountError) throw new Error(accountError.message);

  const taxEntityById = new Map<string, any>((taxEntities ?? []).map((entity: any) => [String(entity.id), entity]));
  const categoryByName = new Map<string, any>((categories ?? []).map((category: any) => [String(category.name).toLowerCase(), category]));
  const categoryById = new Map<string, any>((categories ?? []).map((category: any) => [String(category.id), category]));

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
    const [accountId, pattern] = key.split("|");
    const rawAccount = rows[0].books_financial_accounts;
    const account = (Array.isArray(rawAccount) ? rawAccount[0] : rawAccount) as any;
    const totalAmount = rows.reduce((sum: number, tx: any) => sum + Number(tx.amount ?? 0), 0);
    const isRepeatedPattern = rows.length >= 2;
    const isHighImpactSingle = rows.length === 1 && Math.abs(totalAmount) >= 250;
    const representative = rows[0];
    const storedSuggestion = representative.metadata?.category_suggestion;
    const storedCategory = storedSuggestion?.category_id != null
      ? categoryById.get(String(storedSuggestion.category_id))
      : null;
    const isQueuedAiSuggestion = Boolean(storedCategory);
    if (!isRepeatedPattern && !isHighImpactSingle && !isQueuedAiSuggestion) continue;

    const defaultCategoryName = defaultCategoryNameForPattern(pattern, Number(representative.amount ?? 0));
    let category = categoryByName.get(defaultCategoryName.toLowerCase()) ?? null;
    let confidence = isRepeatedPattern
      ? (account?.tax_entity_id ? 0.92 : 0.78)
      : isQueuedAiSuggestion
        ? 0.55
        : (account?.tax_entity_id ? 0.82 : 0.66);
    let reason = isRepeatedPattern
      ? (account?.tax_entity_id
        ? `Grouped by account and merchant/description pattern. Account is assigned to ${taxEntityById.get(String(account.tax_entity_id))?.name ?? "a Tax Entity"}.`
        : "Grouped by repeated merchant/description pattern. Needs Tax Entity confirmation.")
      : isQueuedAiSuggestion
        ? "Cashpile AI had a possible category match below the auto-apply confidence threshold."
        : (account?.tax_entity_id
          ? `High-impact transaction needs Category confirmation. Account is assigned to ${taxEntityById.get(String(account.tax_entity_id))?.name ?? "a Tax Entity"}.`
          : "High-impact transaction needs Category or Tax Entity confirmation.");
    if (storedCategory && typeof storedSuggestion?.confidence === "number") {
      category = storedCategory;
      confidence = Math.min(confidence, storedSuggestion.confidence);
      reason += ` Cashpile AI suggested ${storedCategory.name} during automation; confirm before applying.`;
    }

    if ((!storedCategory && (!category || defaultCategoryName === "Other")) && categories?.length) {
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
          const aiCategory = categoryByName.get(aiResult.categoryName.toLowerCase()) ?? null;
          if (aiCategory) {
            category = aiCategory;
            confidence = Math.max(confidence, Math.min(aiResult.confidence, 0.9));
            reason += ` AI suggested ${aiResult.categoryName}.`;
          }
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
    accounts: accounts ?? [],
    activeAccount: scopedAccountId
      ? (accounts ?? []).find((account: any) => String(account.id) === scopedAccountId) ?? null
      : null,
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
    updatedTransactions = await updateCategoryWithAudit(supabase as any, user.id, transactionIds, input.categoryId, {
      method: "ai_review",
      pattern: input.pattern,
      confidence: 1,
      rule_scope: input.accountId ? "account" : "global",
    });
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
      await createCategoryRule({ pattern: input.pattern, categoryId: input.categoryId, source: "manual", priority: input.accountId ? 100 : 80, accountId: input.accountId ?? null });
      categoryRuleCreated = true;
    }
    if (input.taxEntityId) {
      await createTaxAssignmentRule({ pattern: input.pattern, match_type: "contains", tax_entity_id: input.taxEntityId, priority: input.accountId ? 100 : 80, financial_account_id: input.accountId ?? null });
      taxRuleCreated = true;
    }
  }

  if (input.applyAccountDefault && input.accountId && input.taxEntityId) {
    const result = await assignAccountToTaxEntity(input.accountId, input.taxEntityId);
    assignedTaxViews = Math.max(assignedTaxViews, result.assigned_transaction_count ?? 0);
    accountRuleUpdated = true;
  }

  revalidatePath("/books/transactions");
  revalidatePath("/books/transactions/ai-review");
  revalidatePath("/books/tax");
  return { updatedTransactions, assignedTaxViews, categoryRuleCreated, taxRuleCreated, accountRuleUpdated };
}

export async function applyAiInstruction(input: {
  instruction: string;
  accountId?: string | null;
  pattern?: string | null;
  categoryId?: string | number | null;
  taxEntityId?: string | null;
  applyToExisting?: boolean;
  setAccountDefault?: boolean;
  dryRun?: boolean;
}): Promise<{
  instruction: string;
  inferredAccountName: string | null;
  inferredPattern: string | null;
  inferredCategoryName: string | null;
  inferredTaxEntityName: string | null;
  matchedTransactions: number;
  uncategorizedMatches: number;
  willSetAccountDefault: boolean;
  willCreateCategoryRule: boolean;
  willCreateTaxRule: boolean;
  ruleScope: "account" | "global";
  accountDefaultApplied: boolean;
  categoryRuleCreated: boolean;
  taxRuleCreated: boolean;
  categorizedTransactions: number;
  assignedTaxViews: number;
  interpretationSource: "explicit" | "deterministic" | "ai";
  interpretationReason: string | null;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const instruction = input.instruction.trim();
  if (instruction.length < 8) throw new Error("Tell Cashpile what should go where.");

  const [{ data: accounts, error: accountError }, { data: categories, error: categoryError }, { data: taxEntities, error: entityError }] = await Promise.all([
    (supabase as any)
      .from("books_financial_accounts")
      .select("id, name, institution_name, last_four_digits, tax_entity_id")
      .eq("user_id", user.id)
      .eq("is_active", true),
    (supabase as any)
      .from("books_categories")
      .select("id, name, category_type, parent_category_id")
      .eq("user_id", user.id),
    (supabase as any)
      .from("books_business_entities")
      .select("id, name, entity_type")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);
  if (accountError) throw new Error(accountError.message);
  if (categoryError) throw new Error(categoryError.message);
  if (entityError) throw new Error(entityError.message);

  let account = input.accountId
    ? (accounts ?? []).find((row: any) => String(row.id) === String(input.accountId))
    : findMentionedRow(instruction, accounts ?? [], (row: any) => [
      row.institution_name ?? "",
      row.last_four_digits ? `*${row.last_four_digits}` : "",
      row.last_four_digits ?? "",
    ]);
  let category = input.categoryId
    ? (categories ?? []).find((row: any) => String(row.id) === String(input.categoryId))
    : findMentionedRow(instruction, categories ?? []);
  let taxEntity = input.taxEntityId
    ? (taxEntities ?? []).find((row: any) => String(row.id) === String(input.taxEntityId))
    : findMentionedRow(instruction, taxEntities ?? []);
  let pattern = normalizePattern(input.pattern) || extractInstructionPattern(instruction);
  let interpretationSource: "explicit" | "deterministic" | "ai" =
    input.accountId || input.pattern || input.categoryId || input.taxEntityId ? "explicit" : "deterministic";
  let interpretationReason: string | null = null;

  if (!account || !pattern || !category || !taxEntity) {
    try {
      const categoryById = new Map((categories ?? []).map((row: any) => [String(row.id), row]));
      const taxEntityById = new Map((taxEntities ?? []).map((row: any) => [String(row.id), row]));
      const accountById = new Map((accounts ?? []).map((row: any) => [String(row.id), row]));
      const parentById = new Map((categories ?? []).map((row: any) => [String(row.id), row.name]));
      const parsed = await parseBooksInstruction({
        instruction,
        accounts: buildInstructionOptions(accounts ?? [], (row: any) => [
          row.institution_name ?? "",
          row.last_four_digits ? `*${row.last_four_digits}` : "",
          row.last_four_digits ?? "",
        ]),
        categories: buildInstructionOptions(categories ?? [], (row: any) => [
          row.parent_category_id ? `${parentById.get(String(row.parent_category_id)) ?? ""} / ${row.name}` : "",
        ]),
        taxEntities: buildInstructionOptions(taxEntities ?? [], (row: any) => [row.entity_type ?? ""]),
      });

      if (parsed && parsed.confidence >= 0.65) {
        if (!input.accountId && !account && parsed.accountId && accountById.has(String(parsed.accountId))) {
          account = accountById.get(String(parsed.accountId));
        }
        if (!input.pattern && !pattern && parsed.pattern) {
          pattern = normalizePattern(parsed.pattern);
        }
        if (!input.categoryId && !category && parsed.categoryId != null && categoryById.has(String(parsed.categoryId))) {
          category = categoryById.get(String(parsed.categoryId));
        }
        if (!input.taxEntityId && !taxEntity && parsed.taxEntityId && taxEntityById.has(String(parsed.taxEntityId))) {
          taxEntity = taxEntityById.get(String(parsed.taxEntityId));
        }
        interpretationSource = "ai";
        interpretationReason = parsed.reason || null;
      }
    } catch {
      // AI interpretation is best-effort. Deterministic fields and explicit picks still work without AI credentials.
    }
  }

  if (!account && !pattern) {
    throw new Error("Choose an account or include a quoted merchant/pattern, e.g. \"ANTHROPIC\".");
  }
  if (!category && !taxEntity) {
    throw new Error("Choose or mention a Category or Tax Entity.");
  }

  let accountDefaultApplied = false;
  let assignedTaxViews = 0;
  const willSetAccountDefault = Boolean(account && taxEntity && input.setAccountDefault !== false);
  const ruleScope = account ? "account" : "global";
  if (!input.dryRun && willSetAccountDefault) {
    const result = await assignAccountToTaxEntity(account.id, taxEntity.id);
    assignedTaxViews += result.assigned_transaction_count ?? 0;
    accountDefaultApplied = true;
  }

  let categoryRuleCreated = false;
  let taxRuleCreated = false;
  let categorizedTransactions = 0;
  const matchingTransactionIds: string[] = [];
  const uncategorizedMatchingTransactionIds: string[] = [];

  if (pattern || (account && category)) {
    let q = (supabase as any)
      .from("books_transactions")
      .select("id, merchant, description, category_id")
      .eq("user_id", user.id)
      .eq("is_transfer", false)
      .limit(10000);
    if (account) q = q.eq("financial_account_id", account.id);

    const { data: candidates, error: candidateError } = await q;
    if (candidateError) throw new Error(candidateError.message);

    for (const tx of candidates ?? []) {
      let isMatch = false;
      if (!pattern) {
        isMatch = true;
      } else {
        const values = [normalizePattern(tx.merchant), normalizePattern(tx.description)].filter(Boolean);
        isMatch = values.some((value) => value.includes(pattern) || pattern.split(" ").every((token) => value.split(" ").includes(token)));
      }

      if (isMatch) {
        matchingTransactionIds.push(tx.id);
        if (!tx.category_id) uncategorizedMatchingTransactionIds.push(tx.id);
      }
    }
  }

  const willCreateCategoryRule = Boolean(category && pattern);
  const willCreateTaxRule = Boolean(taxEntity && pattern);

  if (category) {
    if (!input.dryRun && willCreateCategoryRule) {
      await createCategoryRule({ pattern, categoryId: category.id, source: "manual", priority: account ? 120 : 90, accountId: account?.id ?? null });
      categoryRuleCreated = true;
    }
    if (!input.dryRun && input.applyToExisting !== false && uncategorizedMatchingTransactionIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < uncategorizedMatchingTransactionIds.length; i += chunkSize) {
        const ids = uncategorizedMatchingTransactionIds.slice(i, i + chunkSize);
        categorizedTransactions += await updateCategoryWithAudit(supabase as any, user.id, ids, category.id, {
          method: "ai_instruction",
          pattern: pattern || null,
          confidence: 1,
          rule_scope: ruleScope,
          instruction: instruction.slice(0, 180),
        }, true);
      }
    }
  }

  if (!input.dryRun && willCreateTaxRule) {
    await createTaxAssignmentRule({ pattern, match_type: "contains", tax_entity_id: taxEntity.id, priority: account ? 120 : 90, financial_account_id: account?.id ?? null });
    taxRuleCreated = true;
  }
  if (!input.dryRun && taxEntity && input.applyToExisting !== false && matchingTransactionIds.length > 0 && !accountDefaultApplied) {
    const result = await assignTransactions({
      transactionIds: matchingTransactionIds,
      taxEntityId: taxEntity.id,
      categoryId: category ? Number(category.id) : undefined,
      isDeductible: true,
      notes: `AI instruction: ${instruction.slice(0, 180)}`,
    });
    assignedTaxViews += result.assigned;
  }

  if (!input.dryRun) {
    revalidatePath("/books/transactions");
    revalidatePath("/books/transactions/ai-review");
    revalidatePath("/books/category-rules");
    revalidatePath("/books/tax");
    revalidatePath("/books/accounts");
  }

  return {
    instruction,
    inferredAccountName: account?.name ?? null,
    inferredPattern: pattern || null,
    inferredCategoryName: category?.name ?? null,
    inferredTaxEntityName: taxEntity?.name ?? null,
    matchedTransactions: matchingTransactionIds.length,
    uncategorizedMatches: uncategorizedMatchingTransactionIds.length,
    willSetAccountDefault,
    willCreateCategoryRule,
    willCreateTaxRule,
    ruleScope,
    accountDefaultApplied,
    categoryRuleCreated,
    taxRuleCreated,
    categorizedTransactions,
    assignedTaxViews,
    interpretationSource,
    interpretationReason,
  };
}
