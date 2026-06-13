type CategorizationMethod = "category_rule" | "learned_rule" | "default_rule" | "ai" | "rule_based";

interface CategoryRow {
  id: string | number;
  name: string;
}

export interface CategorySuggestion {
  transactionId: string;
  categoryId: string | number;
  categoryName: string;
  confidence: number;
  method: CategorizationMethod;
}

export function toReviewSuggestion(
  result: { transactionId: string; confidence: number; method: "ai" | "rule_based" | "fallback" },
  category: CategoryRow,
  minConfidence: number
): CategorySuggestion | null {
  if (result.confidence >= minConfidence || result.confidence < 0.5) return null;
  return {
    transactionId: result.transactionId,
    categoryId: category.id,
    categoryName: category.name,
    confidence: result.confidence,
    method: result.method === "rule_based" ? "rule_based" : "ai",
  };
}
