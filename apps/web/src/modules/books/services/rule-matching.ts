export interface CategoryRuleForMatching {
  id: string;
  pattern: string;
  match_type: "contains" | "equals";
  category_id: string | number;
  priority?: number;
  financial_account_id?: string | null;
}

export interface CategoryForMatching {
  id: string | number;
  name: string;
}

export interface TransactionForCategoryMatching {
  id: string;
  description: string;
  merchant?: string | null;
  financial_account_id?: string | null;
}

export interface CategoryRuleMatch {
  transactionId: string;
  categoryId: string | number;
  categoryName: string;
  confidence: number;
  method: "category_rule";
  ruleId: string;
}

export interface TaxRuleForMatching {
  pattern: string;
  match_type: "contains" | "equals";
  financial_account_id?: string | null;
}

export interface TransactionForTaxMatching {
  description: string;
  merchant?: string | null;
  financial_account_id?: string | null;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|payment|purchase|pos|debit|card|online)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCategoryRuleMatch(
  tx: TransactionForCategoryMatching,
  rules: CategoryRuleForMatching[],
  categories: CategoryForMatching[]
): CategoryRuleMatch | null {
  const normalized = normalizeText(`${tx.merchant ?? ""} ${tx.description}`);

  for (const rule of rules) {
    if (rule.financial_account_id && rule.financial_account_id !== tx.financial_account_id) continue;
    const pattern = normalizeText(rule.pattern);
    if (!pattern) continue;
    const isMatch = rule.match_type === "equals" ? normalized === pattern : normalized.includes(pattern);
    if (!isMatch) continue;

    const category = categories.find((item) => String(item.id) === String(rule.category_id));
    if (!category) continue;

    return {
      transactionId: tx.id,
      categoryId: category.id,
      categoryName: category.name,
      confidence: 0.99,
      method: "category_rule",
      ruleId: rule.id,
    };
  }

  return null;
}

export function transactionMatchesTaxRule(
  transaction: TransactionForTaxMatching,
  rule: TaxRuleForMatching
): boolean {
  if (rule.financial_account_id && rule.financial_account_id !== transaction.financial_account_id) {
    return false;
  }

  const text = `${transaction.description} ${transaction.merchant ?? ""}`.toLowerCase();
  const pattern = rule.pattern.toLowerCase();

  if (rule.match_type === "equals") {
    return text === pattern;
  }

  return text.includes(pattern);
}
