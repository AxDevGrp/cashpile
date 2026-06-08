/**
 * Tax Assignment Rule Engine
 * 
 * Applies user-defined rules to auto-assign transactions to Tax Entities.
 * Rules are matched by pattern (contains/equals) on transaction description/merchant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@cashpile/db";

export interface TaxAssignmentRule {
  id: string;
  user_id: string;
  pattern: string;
  match_type: "contains" | "equals";
  tax_entity_id: string;
  business_percentage: number;
  deduction_percentage: number;
  is_active: boolean;
  priority: number;
}

export interface TransactionForRuleMatching {
  id: string;
  description: string;
  merchant?: string | null;
  amount: number;
  date?: string | null;
  category_id?: number | null;
  financial_account_id?: string | null;
}

export interface RuleMatchResult {
  transaction_id: string;
  rule_id?: string;
  tax_entity_id: string;
  business_percentage: number;
  deduction_percentage: number;
  matched_pattern: string;
  source: "rule" | "account";
  amount?: number;
  date?: string | null;
  category_id?: number | null;
}

/**
 * Fetch active rules for a user, sorted by priority (highest first)
 */
export async function fetchActiveRules(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TaxAssignmentRule[]> {
  const { data, error } = await supabase
    .from("books_tax_assignment_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (error) {
    console.error("Failed to fetch tax assignment rules:", error);
    return [];
  }

  return data ?? [];
}

async function fetchAccountTaxDefaults(
  supabase: SupabaseClient<Database>,
  userId: string,
  transactions: TransactionForRuleMatching[]
): Promise<Map<string, { tax_entity_id: string; account_name: string }>> {
  const accountIds = Array.from(
    new Set(transactions.map((tx) => tx.financial_account_id).filter(Boolean))
  ) as string[];

  if (accountIds.length === 0) return new Map();

  const { data, error } = await (supabase as any)
    .from("books_financial_accounts")
    .select("id, name, tax_entity_id")
    .eq("user_id", userId)
    .in("id", accountIds)
    .not("tax_entity_id", "is", null);

  if (error) {
    console.error("Failed to fetch account tax defaults:", error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((account: any) => [
      account.id,
      { tax_entity_id: account.tax_entity_id, account_name: account.name ?? "assigned account" },
    ])
  );
}

/**
 * Check if a transaction matches a rule
 */
function transactionMatchesRule(
  transaction: TransactionForRuleMatching,
  rule: TaxAssignmentRule
): boolean {
  const text = `${transaction.description} ${transaction.merchant ?? ""}`.toLowerCase();
  const pattern = rule.pattern.toLowerCase();

  if (rule.match_type === "equals") {
    return text === pattern;
  }

  // contains
  return text.includes(pattern);
}

/**
 * Find the first matching rule for a transaction
 */
function findMatchingRule(
  transaction: TransactionForRuleMatching,
  rules: TaxAssignmentRule[]
): TaxAssignmentRule | null {
  for (const rule of rules) {
    if (transactionMatchesRule(transaction, rule)) {
      return rule;
    }
  }
  return null;
}

/**
 * Apply rules to a batch of transactions and return matches
 */
export function applyRulesToTransactions(
  transactions: TransactionForRuleMatching[],
  rules: TaxAssignmentRule[]
): RuleMatchResult[] {
  const matches: RuleMatchResult[] = [];

  for (const tx of transactions) {
    const rule = findMatchingRule(tx, rules);
    if (rule) {
      matches.push({
        transaction_id: tx.id,
        rule_id: rule.id,
        tax_entity_id: rule.tax_entity_id,
        business_percentage: rule.business_percentage,
        deduction_percentage: rule.deduction_percentage,
        matched_pattern: rule.pattern,
        source: "rule",
        amount: tx.amount,
        date: tx.date,
        category_id: tx.category_id ?? null,
      });
    }
  }

  return matches;
}

function applyAccountDefaultsToUnmatchedTransactions(
  transactions: TransactionForRuleMatching[],
  accountDefaults: Map<string, { tax_entity_id: string; account_name: string }>,
  existingMatches: RuleMatchResult[]
): RuleMatchResult[] {
  const matchedTransactionIds = new Set(existingMatches.map((match) => match.transaction_id));
  const matches: RuleMatchResult[] = [];

  for (const tx of transactions) {
    if (matchedTransactionIds.has(tx.id) || !tx.financial_account_id) continue;

    const accountDefault = accountDefaults.get(tx.financial_account_id);
    if (!accountDefault) continue;

    matches.push({
      transaction_id: tx.id,
      tax_entity_id: accountDefault.tax_entity_id,
      business_percentage: 100,
      deduction_percentage: 100,
      matched_pattern: accountDefault.account_name,
      source: "account",
      amount: tx.amount,
      date: tx.date,
      category_id: tx.category_id ?? null,
    });
  }

  return matches;
}

/**
 * Persist rule matches to the database (books_tax_transaction_views)
 */
export async function persistRuleMatches(
  supabase: SupabaseClient<Database>,
  userId: string,
  matches: RuleMatchResult[]
): Promise<number> {
  if (matches.length === 0) return 0;

  const inserts = matches.map((match) => ({
    user_id: userId,
    transaction_id: match.transaction_id,
    tax_entity_id: match.tax_entity_id,
    tax_amount: Math.abs(Number(match.amount ?? 0)) * ((match.business_percentage ?? 100) / 100),
    tax_date: match.date ?? null,
    category_id: match.category_id ?? null,
    business_percentage: match.business_percentage,
    deduction_percentage: match.deduction_percentage,
    is_tax_deductible: match.deduction_percentage > 0,
    tax_notes: match.source === "account"
      ? `Auto-assigned by account: ${match.matched_pattern}`
      : `Auto-assigned by rule: ${match.matched_pattern}`,
  }));

  // Use upsert to avoid duplicates (in case rule is re-applied)
  const { error } = await supabase
    .from("books_tax_transaction_views")
    .upsert(inserts, {
      onConflict: "tax_entity_id,transaction_id",
      ignoreDuplicates: true,
    });

  if (error) {
    console.error("Failed to persist rule matches:", error);
    return 0;
  }

  return matches.length;
}

/**
 * Main entry point: fetch rules, apply to transactions, persist matches
 * Returns the number of transactions assigned
 */
export async function autoAssignTaxEntities(
  supabase: SupabaseClient<Database>,
  userId: string,
  transactions: TransactionForRuleMatching[]
): Promise<number> {
  const rules = await fetchActiveRules(supabase, userId);
  const accountDefaults = await fetchAccountTaxDefaults(supabase, userId, transactions);

  if (rules.length === 0 && accountDefaults.size === 0) return 0;

  const ruleMatches = applyRulesToTransactions(transactions, rules);
  const accountMatches = applyAccountDefaultsToUnmatchedTransactions(transactions, accountDefaults, ruleMatches);
  const matches = [...ruleMatches, ...accountMatches];
  const assigned = await persistRuleMatches(supabase, userId, matches);

  console.log(`[tax-assignment] Applied ${rules.length} rules and ${accountDefaults.size} account defaults to ${transactions.length} transactions, assigned ${assigned}`);
  
  return assigned;
}
