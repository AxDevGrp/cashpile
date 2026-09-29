/**
 * Plaid ingestion — pure provider-row normalization (Stage 02).
 *
 * One place converts a Plaid transaction/account into provider-owned fields.
 * The mapper deliberately returns ONLY provider facts: no category, no user
 * notes, no consumer decision. Cents are computed once here from the provider's
 * signed dollar amount; the DB RPC divides by 100 back to ledger dollars.
 */

export class PlaidIngestionError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = "PlaidIngestionError";
    this.code = code;
  }
}

/** Provider signed cents bound; mirrors the DB check constraint. */
export const MAX_AMOUNT_CENTS = 99999999999999;

export interface PlaidTransactionLike {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name?: string | null;
  merchant_name?: string | null;
  pending?: boolean | null;
  pending_transaction_id?: string | null;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
    confidence_level?: string | null;
  } | null;
}

/** Full available provider finance-category object; missing values stay null. */
export interface ProviderFinanceCategory {
  primary: string | null;
  detailed: string | null;
  confidence_level: string | null;
}

export interface PlaidProviderData {
  transaction_id: string;
  account_id: string;
  pending: boolean | null;
  pending_transaction_id: string | null;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  personal_finance_category: ProviderFinanceCategory | null;
}

export interface NormalizedPlaidTransaction {
  financial_account_id: string;
  description: string;
  merchant: string | null;
  amountCents: number;
  date: string;
  transaction_type: "debit" | "credit";
  plaid_transaction_id: string;
  provider_data: PlaidProviderData;
}

/**
 * Provider signed dollars → Cashpile signed cents. Plaid positive = debit, so
 * the sign is inverted to keep Cashpile's credit-positive convention.
 */
export function toAmountCents(providerDollarAmount: number): number {
  if (typeof providerDollarAmount !== "number" || !Number.isFinite(providerDollarAmount)) {
    throw new PlaidIngestionError("invalid_amount");
  }
  const cents = -Math.round(providerDollarAmount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_AMOUNT_CENTS) {
    throw new PlaidIngestionError("invalid_amount");
  }
  return cents;
}

function normalizeFinanceCategory(
  category: PlaidTransactionLike["personal_finance_category"]
): ProviderFinanceCategory | null {
  if (!category) return null;
  return {
    primary: category.primary ?? null,
    detailed: category.detailed ?? null,
    confidence_level: category.confidence_level ?? null,
  };
}

/**
 * Missing account mapping blocks ingestion (never writes a null account).
 * Unknown provider fields are preserved as null and do not become instructions.
 */
export function normalizePlaidTransaction(
  transaction: PlaidTransactionLike,
  accountId: string | null | undefined
): NormalizedPlaidTransaction {
  if (!accountId) {
    throw new PlaidIngestionError("missing_account_mapping");
  }
  const plaidId = transaction.transaction_id;
  if (!plaidId) {
    throw new PlaidIngestionError("missing_provider_id");
  }

  const amountCents = toAmountCents(transaction.amount);

  return {
    financial_account_id: accountId,
    description: transaction.name ?? "",
    merchant: transaction.merchant_name ?? null,
    amountCents,
    date: transaction.date,
    transaction_type: amountCents < 0 ? "debit" : "credit",
    plaid_transaction_id: plaidId,
    provider_data: {
      transaction_id: transaction.transaction_id,
      account_id: transaction.account_id,
      pending: transaction.pending ?? null,
      pending_transaction_id: transaction.pending_transaction_id ?? null,
      iso_currency_code: transaction.iso_currency_code ?? null,
      unofficial_currency_code: transaction.unofficial_currency_code ?? null,
      personal_finance_category: normalizeFinanceCategory(transaction.personal_finance_category),
    },
  };
}

export interface PlaidBalanceLike {
  current?: number | null;
  available?: number | null;
  iso_currency_code?: string | null;
}

export interface NormalizedPlaidBalance {
  current_balance: number | null;
  available_balance: number | null;
  currency_code: string | null;
}

/** Unknown balances/currency stay null; never coerce a missing balance to zero. */
export function normalizePlaidBalance(balance: PlaidBalanceLike | null | undefined): NormalizedPlaidBalance {
  const current = balance?.current;
  const available = balance?.available;
  return {
    current_balance: typeof current === "number" && Number.isFinite(current) ? current : null,
    available_balance: typeof available === "number" && Number.isFinite(available) ? available : null,
    currency_code: balance?.iso_currency_code ?? null,
  };
}
