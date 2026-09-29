/**
 * Canonical Cashboard metric builder (Stage 03).
 *
 * Pure: consumes normalized source facts (already in cents) and produces the
 * five contract metrics. No database, network or model access here; the caller
 * (service.ts) loads and normalizes once.
 */

import { addDays, monthlyEquivalentCents } from "./calc.ts";
import type {
  CashboardMetric,
  CashboardMetricId,
  CashboardMetricRow,
  CashboardReviewSummary,
  CashboardWarning,
  CashflowRole,
} from "./types";

export interface CashboardAccountInput {
  id: string;
  name: string;
  role: CashflowRole;
  accountType: string;
  included: boolean;
  /** Null means unknown, never assumed USD. */
  currencyCode: string | null;
  /** Current balance (net worth, debt, cushion). Null = unknown. */
  currentBalanceCents: number | null;
  /** Available ?? current (forecasting). Null = unknown. */
  spendableCents: number | null;
  /** True when the provider supplied an available balance. */
  availableKnown: boolean;
  balanceAsOf: string | null;
  isEmergency: boolean;
  /** Posted pending debits still outstanding on this account. */
  pendingDebitCents: number;
}

export interface CashboardScheduledFlow {
  id: string;
  date: string;
  label: string;
  /** Positive magnitude. */
  amountCents: number;
  direction: "income" | "expense";
  /** True when an expense leaves spendable cash (bills, savings transfers, allowance). */
  consumesSpendingCash: boolean;
  kind: "bill" | "income" | "savings_transfer" | "card_payment" | "allowance" | "scenario";
  accountId?: string;
}

export interface CashboardReceipt {
  id: string;
  date: string;
  label: string;
  /** Positive magnitude. */
  amountCents: number;
  accountId: string;
  kind: string;
  pending: boolean;
  /** True only for a user decision or that user's exact remembered rule. */
  confirmed: boolean;
}

export interface CashboardInput {
  /** Snapshot generation time. */
  asOf: string;
  timezone: string;
  /** Local calendar date (timezone-derived), never UTC-truncated. */
  today: string;
  monthStart: string;
  accounts: CashboardAccountInput[];
  scheduledFlows: CashboardScheduledFlow[];
  /** Last day of the availability window (day before payday, or today+13). */
  windowEnd: string;
  payday: { nextPayday: string | null; provisional: boolean };
  bufferCents: number;
  essentialWeeklyAllowanceCents: number | null;
  /** Monthly equivalent of included standard recurring cash outflows. */
  essentialMonthlyCommitmentsCents: number | null;
  receipts: CashboardReceipt[];
  unresolvedPositiveCents: number;
  review: CashboardReviewSummary;
  /** Projected shortfall inside the 30-day risk window, as a positive magnitude. */
  thirtyDayShortfallCents: number;
  /** Balance timestamps before this instant are stale (>48h). */
  staleBeforeMs: number;
}

const PASSIVE_ACCOUNT_ROLES: CashflowRole[] = ["spending_source", "reserve"];

function metric(
  id: CashboardMetricId,
  unit: CashboardMetric["unit"],
  quality: CashboardMetric["quality"],
  value: number | null,
  period: CashboardMetric["period"],
  asOf: string | null,
  reasons: string[],
  rows: CashboardMetricRow[]
): CashboardMetric {
  return { id, unit, quality, value, period, asOf, reasons, rows };
}

function unavailable(row: CashboardMetric, reason: string): CashboardMetric {
  return { ...row, value: null, quality: "unavailable", reasons: [...row.reasons, reason] };
}

/** Included, non-ignore accounts are the relevant universe for every metric. */
function relevantAccounts(input: CashboardInput): CashboardAccountInput[] {
  return input.accounts.filter((a) => a.included && a.role !== "ignore");
}

function currencyBlockedReasons(accounts: CashboardAccountInput[]): string[] {
  const reasons: string[] = [];
  for (const account of accounts) {
    if (account.currencyCode === "USD") continue;
    reasons.push(account.currencyCode == null ? "currency_unknown" : "currency_mismatch");
  }
  return [...new Set(reasons)];
}

// ── available ───────────────────────────────────────────────────────────────

function buildAvailable(input: CashboardInput, currencyReasons: string[]): CashboardMetric {
  const rows: CashboardMetricRow[] = [];
  const spendable = input.accounts.filter(
    (a) => a.included && a.role === "spending_source" && a.spendableCents != null
  );
  const base = metric(
    "available",
    "USD_cents",
    "estimated",
    null,
    { from: input.today, through: input.windowEnd },
    input.asOf,
    [],
    rows
  );

  if (currencyReasons.length) return unavailable(base, currencyReasons[0]);
  if (!spendable.length) return unavailable(base, "no_included_spending_account");

  const stale = spendable.some(
    (a) => !a.balanceAsOf || new Date(a.balanceAsOf).getTime() < input.staleBeforeMs
  );
  if (stale) return unavailable(base, "balance_stale");

  const pendingUncertain = spendable.some((a) => !a.availableKnown && a.pendingDebitCents > 0);
  if (pendingUncertain) return unavailable(base, "pending_balance_uncertain");

  const opening = spendable.reduce((sum, a) => sum + a.spendableCents!, 0);
  const windowFlows = input.scheduledFlows.filter((f) => f.date >= input.today && f.date <= input.windowEnd);

  let balance = opening;
  let low = opening;
  let lowDate = input.today;
  let cursor = input.today;
  for (let guard = 0; cursor <= input.windowEnd && guard < 400; guard++, cursor = addDays(cursor, 1)) {
    const dayNet = windowFlows
      .filter((f) => f.date === cursor)
      .reduce((sum, f) => {
        if (f.direction === "income") return sum + f.amountCents;
        return sum + (f.consumesSpendingCash ? -f.amountCents : 0);
      }, 0);
    balance += dayNet;
    if (balance < low) {
      low = balance;
      lowDate = cursor;
    }
  }

  rows.push({ id: "opening", label: "Spendable now", value: opening });
  for (const flow of windowFlows.filter((f) => f.direction === "expense" && f.consumesSpendingCash)) {
    rows.push({ id: flow.id, label: flow.label, value: -flow.amountCents });
  }
  rows.push({ id: "buffer", label: "Safety buffer", value: -input.bufferCents });

  const value = low - input.bufferCents;
  const reasons = ["forecast_estimate"];
  if (input.payday.provisional) reasons.push("payday_provisional");
  if (value < 0) reasons.push("projected_shortfall");
  return {
    ...base,
    value,
    quality: "estimated",
    asOf: spendable.map((a) => a.balanceAsOf).filter((v): v is string => !!v).sort()[0] ?? null,
    reasons,
    rows: [...rows, { id: "low", label: `Low on ${lowDate}`, value: low }],
  };
}

// ── passive income ──────────────────────────────────────────────────────────

function buildPassiveIncome(input: CashboardInput, currencyReasons: string[]): CashboardMetric {
  const rows: CashboardMetricRow[] = [];
  const base = metric(
    "passive-income",
    "USD_cents",
    "available",
    null,
    { from: input.monthStart, through: input.today },
    null,
    [],
    rows
  );
  if (currencyReasons.length) return unavailable(base, currencyReasons[0]);

  const rolesById = new Map(input.accounts.map((a) => [a.id, a.role]));
  const qualifying = input.receipts.filter(
    (r) =>
      r.confirmed &&
      !r.pending &&
      r.kind === "passive_income" &&
      r.date >= input.monthStart &&
      r.date <= input.today &&
      PASSIVE_ACCOUNT_ROLES.includes(rolesById.get(r.accountId) ?? "ignore")
  );
  for (const receipt of qualifying) {
    rows.push({ id: receipt.id, label: receipt.label, value: receipt.amountCents });
  }
  const value = qualifying.reduce((sum, r) => sum + r.amountCents, 0);
  const reasons = ["cash_receipts_before_expenses"];
  const quality = input.unresolvedPositiveCents > 0 ? "estimated" : "available";
  if (input.unresolvedPositiveCents > 0) reasons.push("unresolved_credit");
  return { ...base, value, quality, reasons, rows };
}

// ── debt + net worth ────────────────────────────────────────────────────────

interface BalanceTotals {
  assets: number;
  liabilities: number;
  missing: boolean;
}

function sumBalances(accounts: CashboardAccountInput[]): BalanceTotals {
  let assets = 0;
  let liabilities = 0;
  let missing = false;
  for (const account of accounts) {
    if (account.currentBalanceCents == null) {
      missing = true;
      continue;
    }
    if (account.role === "credit_liability" || account.role === "loan") {
      if (account.currentBalanceCents > 0) liabilities += account.currentBalanceCents;
      else assets += -account.currentBalanceCents;
    } else {
      assets += account.currentBalanceCents;
    }
  }
  return { assets, liabilities, missing };
}

function buildNetWorth(input: CashboardInput, currencyReasons: string[]): CashboardMetric {
  const accounts = relevantAccounts(input);
  const rows: CashboardMetricRow[] = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    value: a.currentBalanceCents,
    href: `/books/accounts`,
  }));
  const asOf = accounts.map((a) => a.balanceAsOf).filter((v): v is string => !!v).sort()[0] ?? null;
  const base = metric("net-worth", "USD_cents", "available", null, null, asOf, [], rows);
  if (currencyReasons.length) return unavailable(base, currencyReasons[0]);
  if (!accounts.length) return unavailable(base, "no_included_account");

  const totals = sumBalances(accounts);
  if (totals.missing) return unavailable(base, "missing_current_balance");
  return { ...base, value: totals.assets - totals.liabilities, quality: "available" };
}

function buildDebt(input: CashboardInput, currencyReasons: string[]): CashboardMetric {
  const liabilities = relevantAccounts(input).filter(
    (a) => a.role === "credit_liability" || a.role === "loan"
  );
  const rows: CashboardMetricRow[] = liabilities.map((a) => ({
    id: a.id,
    label: a.name,
    value: a.currentBalanceCents == null ? null : Math.max(0, a.currentBalanceCents),
    href: `/books/accounts`,
  }));
  const asOf = liabilities.map((a) => a.balanceAsOf).filter((v): v is string => !!v).sort()[0] ?? null;
  const base = metric("debt", "USD_cents", "available", null, null, asOf, [], rows);
  if (currencyReasons.length) return unavailable(base, currencyReasons[0]);
  if (liabilities.some((a) => a.currentBalanceCents == null)) return unavailable(base, "missing_current_balance");

  const value = liabilities.reduce((sum, a) => sum + Math.max(0, a.currentBalanceCents ?? 0), 0);
  return { ...base, value, quality: "available" };
}

// ── cushion ─────────────────────────────────────────────────────────────────

function buildCushion(input: CashboardInput, currencyReasons: string[]): CashboardMetric {
  const reserveAccounts = relevantAccounts(input).filter((a) => a.role === "reserve" && a.isEmergency);
  const rows: CashboardMetricRow[] = reserveAccounts.map((a) => ({
    id: a.id,
    label: a.name,
    value: a.currentBalanceCents,
    href: `/books/accounts`,
  }));
  const asOf = reserveAccounts.map((a) => a.balanceAsOf).filter((v): v is string => !!v).sort()[0] ?? null;
  const base = metric("cushion", "months", "available", null, null, asOf, [], rows);
  if (currencyReasons.length) return unavailable(base, currencyReasons[0]);
  if (reserveAccounts.some((a) => a.currentBalanceCents == null)) return unavailable(base, "missing_current_balance");
  if (input.essentialWeeklyAllowanceCents == null) return unavailable(base, "essential_allowance_missing");
  if (input.essentialMonthlyCommitmentsCents == null) return unavailable(base, "commitments_unknown");

  const reserveCents = reserveAccounts.reduce((sum, a) => sum + (a.currentBalanceCents ?? 0), 0);
  const allowanceMonthly = monthlyEquivalentCents(input.essentialWeeklyAllowanceCents, "weekly");
  const denominator = input.essentialMonthlyCommitmentsCents + allowanceMonthly;
  if (denominator <= 0) return unavailable(base, "commitments_nonpositive");

  rows.push({ id: "reserve", label: "Emergency reserve", value: reserveCents });
  rows.push({ id: "commitments", label: "Estimated monthly commitments", value: -denominator });
  return { ...base, value: reserveCents / denominator, quality: "available", reasons: ["estimated_commitments"] };
}

export interface CashboardMetricsResult {
  metrics: Record<CashboardMetricId, CashboardMetric>;
  warnings: CashboardWarning[];
}

export function buildCashboardMetrics(input: CashboardInput): CashboardMetricsResult {
  const currencyReasons = currencyBlockedReasons(relevantAccounts(input));

  const metrics: Record<CashboardMetricId, CashboardMetric> = {
    available: buildAvailable(input, currencyReasons),
    "passive-income": buildPassiveIncome(input, currencyReasons),
    debt: buildDebt(input, currencyReasons),
    cushion: buildCushion(input, currencyReasons),
    "net-worth": buildNetWorth(input, currencyReasons),
  };

  const warnings: CashboardWarning[] = [];
  for (const reason of currencyReasons) {
    warnings.push({
      code: reason,
      message:
        reason === "currency_mismatch"
          ? "An included account is not USD; consumer totals are unavailable until it is excluded."
          : "An included account has an unknown currency; confirm or exclude it to see totals.",
    });
  }
  if (input.thirtyDayShortfallCents > 0) {
    warnings.push({
      code: "thirty_day_risk",
      message: `A bill after the current window creates a projected 30-day shortfall of ${input.thirtyDayShortfallCents} cents.`,
    });
  }
  if (metrics.available.reasons.includes("balance_stale")) {
    warnings.push({ code: "balance_stale", message: "Balance is older than 48 hours; spending is unavailable." });
  }

  return { metrics, warnings };
}

/** Timezone-derived calendar date; never UTC date truncation. */
export function localCalendarDate(
  nowIso: string,
  timezone: string,
  fallbackTimezone = "America/New_York"
): { today: string; assumedTimezone: boolean } {
  const date = new Date(nowIso);
  const format = (tz: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  try {
    return { today: format(timezone || fallbackTimezone), assumedTimezone: !timezone };
  } catch {
    return { today: format(fallbackTimezone), assumedTimezone: true };
  }
}
