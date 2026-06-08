export type CashflowRole =
  | "spending_source"
  | "reserve"
  | "credit_liability"
  | "investment"
  | "loan"
  | "ignore";

export type RecurringCadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual" | "irregular";
export type CashflowDirection = "income" | "expense";

export interface CashflowAccount {
  id: string;
  name: string;
  accountType: string;
  currentBalance: number;
  role: CashflowRole;
  included: boolean;
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
}

export interface ForecastItem {
  id: string;
  date: string;
  label: string;
  amount: number;
  direction: CashflowDirection;
  recurringItemId?: string;
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
}

export interface CashflowSnapshot {
  accounts: CashflowAccount[];
  recurringItems: RecurringItem[];
  forecast: CashflowForecast;
  minimumBuffer: number;
  safeToSpend: number;
  nextIncomeDate: string | null;
  assumptions: string[];
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
}
