export type CashflowRole =
  | "spending_source"
  | "reserve"
  | "credit_liability"
  | "investment"
  | "loan"
  | "ignore";

export type RecurringCadence = "weekly" | "biweekly" | "twice_monthly" | "monthly" | "quarterly" | "annual" | "irregular";
export type CashflowDirection = "income" | "expense";

/**
 * How a recurring item relates to internal money movement:
 * - "standard": real income or expense
 * - "internal_transfer": pairs with an opposite item landing in a reserve/investment
 *   account (e.g. automatic savings transfer). Excluded from margin income/expense;
 *   shown as a savings allocation. The spending-side leg still leaves spendable cash.
 * - "card_payment": pairs with a credit landing on a credit liability account.
 *   Excluded from margin expenses (the purchase is counted once); still leaves spendable cash.
 */
export type RecurringFlowKind = "standard" | "internal_transfer" | "card_payment";

export interface CashflowAccount {
  id: string;
  name: string;
  accountType: string;
  currentBalance: number;
  role: CashflowRole;
  included: boolean;
  /** Plaid available balance if known; spendable cash uses this when present. */
  availableBalance?: number | null;
  /** ISO datetime of the balance basis (Plaid last_synced_at or account updated_at). */
  balanceAsOf?: string | null;
  /** Emergency-designated reserve (user-confirmed; only these count toward the cushion). */
  isEmergency?: boolean;
}

export interface RecurringItem {
  id: string;
  merchant: string;
  descriptionPattern: string;
  averageAmount: number;
  direction: CashflowDirection;
  cadence: RecurringCadence;
  nextExpectedDate: string;
  confidence: number;
  accountIds: string[];
  transactionIds: string[];
  lastSeenDate: string;
  /** Dominant day(s)-of-month for calendar-aware monthly/twice-monthly expansion. */
  anchorDaysOfMonth?: number[];
  /** Internal-flow classification; see RecurringFlowKind. */
  flowKind?: RecurringFlowKind;
  /** Counterpart account ids when this item pairs with an internal flow. */
  counterpartyAccountIds?: string[];
  /** Detection-group identity: `${direction}|${normalizedMerchant}|${amountBucket}`. */
  stableKey?: string;
  /** True when the user confirmed or corrected this item (persisted). */
  confirmed?: boolean;
  /** False when the user marked the item "not recurring"; the transaction itself is untouched. */
  included?: boolean;
  /** Whether this item came from detection or was added manually. */
  source?: "detected" | "manual";
  /** Heuristic proposal (detection) or user-confirmed value (persisted): a subscription charge. */
  isSubscription?: boolean;
  /** User's review decision for a subscription: keep / review / reported cancelling. */
  reviewStatus?: "keep" | "review" | "cancel_help" | null;
}

export interface ForecastItem {
  id: string;
  date: string;
  label: string;
  amount: number;
  direction: CashflowDirection;
  recurringItemId?: string;
  /** Account the cash movement lands on (included spending account), when known. */
  accountId?: string;
  flowKind?: RecurringFlowKind;
}

export interface CashflowForecast {
  today: string;
  horizonDays: number;
  currentSpendableBalance: number;
  projectedLowBalance: number;
  projectedEndBalance: number;
  upcomingIncome: ForecastItem[];
  upcomingExpenses: ForecastItem[];
  dailyBalances: Array<{ date: string; projectedBalance: number; items: ForecastItem[] }>;
  /** Date of the projected low balance. */
  projectedLowDate?: string;
  /** Per-account projected lows; aggregate cash can hide an individual account shortfall. */
  perAccountLowBalances?: Record<string, number>;
}

/** Freshness, coverage, and missing-input metadata for every headline number. */
export interface CashflowDataQuality {
  balanceAsOf: string | null;
  balanceStale: boolean;
  historyDays: number;
  historyComplete: boolean;
  accountsIncluded: number;
  accountsExcluded: number;
  pendingCount: number;
  pendingNet: number;
  missingInputs: string[];
}

export interface PaydayWindow {
  /** First day after the window (the payday), or the end of the 14-day fallback window. */
  nextPayday: string | null;
  /** Last day included in the availability window (day before payday). */
  end: string;
  /** True when payday is inferred rather than confirmed (always true until WP2 confirmation). */
  provisional: boolean;
}

export interface CashRisk {
  lowBalance: number;
  lowDate: string;
  minimumBuffer: number;
  /** Amount below zero at the low point; 0 when the low point stays non-negative. */
  shortfall: number;
  firstBelowBufferDate: string | null;
  firstNegativeDate: string | null;
  /** Items scheduled on the low-point date. */
  causes: ForecastItem[];
}

export interface MonthlyMargin {
  month: string;
  /** ISO date through which this month is measured (today for the current month). */
  through: string;
  partialMonth: boolean;
  income: number;
  expenses: number;
  margin: number;
  savingsAllocations: number;
  cardPayments: number;
  /** Prior month's margin measured through the same day-of-month; set only on the current month. */
  comparableMargin?: number;
}

export interface NetWorth {
  assets: number;
  liabilities: number;
  net: number;
  accountsIncluded: number;
  /** Included accounts whose balance is unknown; excluded, never treated as zero. */
  accountsMissingBalance: number;
}

export interface EmergencyCushion {
  reserveBalance: number;
  essentialMonthlyOutflows: number | null;
  /** Months of essential outflows covered; null when essentials are unknown. */
  months: number | null;
  /** True while essentials rely on detected recurring items without a confirmed allowance. */
  estimated: boolean;
  /** User's target cushion in months, when set. */
  targetMonths?: number | null;
}

export interface CashflowSnapshot {
  accounts: CashflowAccount[];
  recurringItems: RecurringItem[];
  forecast: CashflowForecast;
  minimumBuffer: number;
  safeToSpend: number;
  nextIncomeDate: string | null;
  assumptions: string[];
  dataQuality?: CashflowDataQuality;
  paydayWindow?: PaydayWindow;
  /** Discretionary spending possible before the next payday without crossing the buffer. */
  availableUntilPayday?: number | null;
  cashRisk?: CashRisk;
  monthlyMargins?: MonthlyMargin[];
  emergencyCushion?: EmergencyCushion;
  netWorth?: NetWorth;
}

export interface AffordabilityScenario {
  type: "purchase" | "savings_transfer";
  amount: number;
  date: string;
  label?: string;
  reserveAccountId?: string | null;
}

export interface AffordabilityResult {
  status: "yes" | "caution" | "no";
  requestedAmount: number;
  description?: string;
  purchaseDate: string;
  safeToSpendBeforePurchase: number;
  safeToSpendAfterPurchase: number;
  currentSpendableBalance: number;
  projectedLowBalanceAfterPurchase: number;
  minimumBuffer: number;
  horizonDays: number;
  keyReasons: string[];
  blockingObligations: ForecastItem[];
  suggestedMaxPurchase: number;
  forecast: CashflowForecast;
  dataQuality?: CashflowDataQuality;
  availableUntilPaydayBefore?: number | null;
  availableUntilPaydayAfter?: number | null;
  cashRiskAfter?: CashRisk;
  scenario?: AffordabilityScenario;
  projectedLowBalanceBeforePurchase?: number;
  projectedLowBeforeDate?: string;
  emergencyCushionBefore?: EmergencyCushion;
  emergencyCushionAfter?: EmergencyCushion;
}
