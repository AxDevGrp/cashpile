/**
 * Consumer interpretation precedence (Stage 02).
 *
 * Pure, deterministic first pass over a transaction's facts. It may propose a
 * suggestion but never self-authorizes high-stakes financial meaning; anything
 * not confidently derivable stays `unknown` with `review_required=true`.
 */

export type ConsumerKind =
  | "unknown"
  | "spend"
  | "income"
  | "passive_income"
  | "refund"
  | "internal_transfer"
  | "card_payment"
  | "asset_sale"
  | "loan_proceeds";

export type InterpretationSource = "unknown" | "provider" | "rule" | "user";

export interface ConsumerSuggestion {
  kind: ConsumerKind;
  categoryId: number | null;
  reason: string;
}

export interface ConsumerInterpretation {
  kind: ConsumerKind;
  source: InterpretationSource;
  reviewRequired: boolean;
  suggestion: ConsumerSuggestion | null;
}

export interface InterpretationProviderFacts {
  primary: string | null;
  detailed: string | null;
  confidenceLevel: string | null;
}

export interface InterpretationRow {
  /** Signed cents: credits positive, debits negative. */
  amountCents: number;
  description: string;
  merchant: string | null;
  provider: InterpretationProviderFacts | null;
  /** Confident expense category already assigned by the existing engine. */
  engineCategoryId: number | null;
  engineCategoryConfident: boolean;
  /** Model output may propose a category, never authorize meaning. */
  modelCategoryId: number | null;
  modelConfidence: number | null;
  /** Current stored interpretation, if any. */
  existing: { kind: ConsumerKind; source: InterpretationSource; categoryId: number | null } | null;
  /** Provider/source facts changed since the user confirmed. */
  sourceChanged: boolean;
}

export interface ExactRuleMatch {
  kind: ConsumerKind;
  categoryId: number | null;
}

const HIGH_CONFIDENCE = new Set(["HIGH", "VERY_HIGH"]);
const TRANSFER_OR_PAYMENT_PRIMARY = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS"]);

/** Provider category absent + suggestive text must not be auto-converted. */
const SENSITIVE_TEXT = /(zelle|venmo|cash app|transfer|refund|return|reversal|card payment|credit card payment|autopay|loan payment)/i;

function requiresCategory(kind: ConsumerKind): boolean {
  return kind === "spend" || kind === "income";
}

/** review_required=false requires a non-unknown kind; spend/income need a category. */
export function computeReviewRequired(kind: ConsumerKind, categoryId: number | null): boolean {
  if (kind === "unknown") return true;
  if (requiresCategory(kind)) return categoryId === null;
  return false;
}

export function deriveConsumerInterpretation(
  row: InterpretationRow,
  exactRule: ExactRuleMatch | null,
  category: { id: number } | null
): ConsumerInterpretation {
  // 1. A user decision is retained; changed source facts only force reconfirmation.
  if (row.existing?.source === "user" && row.existing.kind !== "unknown") {
    return {
      kind: row.existing.kind,
      source: "user",
      reviewRequired: row.sourceChanged || computeReviewRequired(row.existing.kind, row.existing.categoryId),
      suggestion: null,
    };
  }

  // 2. Exact remembered rule wins over provider heuristics.
  if (exactRule) {
    const categoryId = exactRule.categoryId ?? null;
    const resolved = categoryId !== null && category !== null;
    return {
      kind: exactRule.kind,
      source: "rule",
      reviewRequired: requiresCategory(exactRule.kind) ? !resolved : false,
      suggestion: null,
    };
  }

  const provider = row.provider;

  // 3. Clear provider facts for positive receipts only.
  if (row.amountCents > 0 && provider?.confidenceLevel && HIGH_CONFIDENCE.has(provider.confidenceLevel)) {
    if (provider.detailed === "INCOME_WAGES") {
      return { kind: "income", source: "provider", reviewRequired: true, suggestion: null };
    }
    if (provider.detailed === "INCOME_INTEREST_EARNED" || provider.detailed === "INCOME_DIVIDENDS") {
      return {
        kind: "unknown",
        source: "unknown",
        reviewRequired: true,
        suggestion: { kind: "passive_income", categoryId: null, reason: "provider_interest_or_dividend" },
      };
    }
    // Unrecognized taxonomy values stay unknown rather than approximate matching.
  }

  // 4. Confident expense category on a debit, unless the provider marks a
  //    transfer/loan or the text suggests a transfer/refund/payment case.
  if (row.amountCents < 0 && row.engineCategoryConfident && row.engineCategoryId !== null) {
    const primary = provider?.primary ?? null;
    const blockedByProvider = primary !== null && TRANSFER_OR_PAYMENT_PRIMARY.has(primary);
    const blockedByText = primary === null && SENSITIVE_TEXT.test(`${row.description} ${row.merchant ?? ""}`);
    if (!blockedByProvider && !blockedByText) {
      return { kind: "spend", source: "provider", reviewRequired: false, suggestion: null };
    }
  }

  // 5. Otherwise unknown; a model result may propose but not authorize.
  const suggestion: ConsumerSuggestion | null =
    row.modelCategoryId !== null
      ? { kind: "unknown", categoryId: row.modelCategoryId, reason: "model_suggestion" }
      : null;
  return { kind: "unknown", source: "unknown", reviewRequired: true, suggestion };
}
