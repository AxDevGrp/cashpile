import { createServiceRoleClient } from "@cashpile/db";
import type {
  AffordabilityResult,
  CashboardSnapshot,
  CashflowAccount,
  CashflowDataQuality,
  CashflowForecast,
  CashflowRole,
  CashflowSnapshot,
  EmergencyCushion,
  ForecastItem,
  MonthlyMargin,
  RecurringCadence,
  RecurringFlowKind,
  RecurringItem,
} from "./types";
import {
  buildCashboardMetrics,
  localCalendarDate,
  type CashboardAccountInput,
  type CashboardReceipt,
  type CashboardScheduledFlow,
} from "./cashboard";
import {
  clampHorizonDays,
  computeCashflow,
  computeCushion,
  detectCadence,
  expandOccurrences,
  isBalanceStale,
  isValidISODate,
  looksLikeSubscription,
  median,
  mergeRecurringItems,
  monthlyEquivalentCents,
  nextOccurrenceOnOrAfter,
  parseDate,
  selectPayday,
  simulate,
  toISODate,
  type CalcAccount,
  type CalcInput,
  type CalcObservedTxn,
  type CalcRecurringItem,
  type CalcScenario,
  type PersistedRecurringItem,
  type SimItem,
} from "./calc";

const DAY_MS = 86_400_000;
const STALE_MS = 48 * 3_600_000;
const DETECTION_LOOKBACK_DAYS = 365;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function toCents(dollars: number | null | undefined): number {
  return Math.round((Number(dollars) ?? 0) * 100);
}

function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function normalizeMerchant(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(pos|debit|card|purchase|payment|online|ach|web|id|co|inc|llc)\b/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function defaultRole(accountType: string): CashflowRole {
  if (accountType === "checking" || accountType === "savings" || accountType === "other") return "spending_source";
  if (accountType === "credit_card") return "credit_liability";
  if (accountType === "investment") return "investment";
  if (accountType === "loan") return "loan";
  return "ignore";
}

interface AccountRow {
  id: string;
  name: string;
  account_type: string | null;
  current_balance: number | null;
  available_balance: number | null;
  cashflow_role: string | null;
  cashflow_include: boolean | null;
  plaid_item_id: string | null;
  updated_at: string | null;
  is_emergency: boolean | null;
  currency_code: string | null;
}

async function getAccountRows(userId: string): Promise<AccountRow[]> {
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("books_financial_accounts")
    .select("id, name, account_type, current_balance, available_balance, cashflow_role, cashflow_include, plaid_item_id, updated_at, is_emergency, is_active, currency_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountRow[];
}

async function getUserTimezone(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  const tz = data?.timezone;
  return typeof tz === "string" && tz.length > 0 ? tz : null;
}

export function computeRecurringIdentity(direction: "income" | "expense", merchant: string, amountDollars: number): { stableKey: string; descriptionPattern: string; amountBucket: number } {
  const normalized = normalizeMerchant(merchant);
  const bucket = Math.round(Math.abs(amountDollars) / 5) * 5;
  return { stableKey: `${direction}|${normalized}|${bucket}`, descriptionPattern: normalized, amountBucket: bucket };
}

interface PersistedRecurringRow {
  id: string;
  stable_key: string;
  direction: "income" | "expense";
  merchant: string;
  description_pattern: string;
  cadence: RecurringCadence;
  amount: number;
  next_date: string | null;
  anchor_days_of_month: number[] | null;
  account_ids: string[] | null;
  included: boolean;
  confirmed_at: string | null;
  flow_kind: RecurringFlowKind | null;
  counterparty_account_ids: string[] | null;
  is_subscription: boolean | null;
  review_status: "keep" | "review" | "cancel_help" | null;
  last_seen_date: string | null;
  source: "detected" | "manual";
}

async function loadPersistedRecurring(userId: string): Promise<PersistedRecurringItem[]> {
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("cashflow_recurring_items")
    .select("id, stable_key, direction, merchant, description_pattern, cadence, amount, next_date, anchor_days_of_month, account_ids, included, confirmed_at, flow_kind, counterparty_account_ids, is_subscription, review_status, last_seen_date, source")
    .eq("user_id", userId)
    .order("next_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: PersistedRecurringRow) => ({
    id: row.id,
    stableKey: row.stable_key,
    direction: row.direction,
    merchant: row.merchant,
    descriptionPattern: row.description_pattern,
    amountCents: toCents(row.amount),
    cadence: row.cadence,
    nextDate: row.next_date,
    anchorDaysOfMonth: row.anchor_days_of_month,
    accountIds: row.account_ids ?? [],
    included: row.included,
    confirmedAt: row.confirmed_at,
    flowKind: row.flow_kind ?? "standard",
    counterpartyAccountIds: row.counterparty_account_ids ?? [],
    isSubscription: !!row.is_subscription,
    reviewStatus: row.review_status ?? null,
    lastSeenDate: row.last_seen_date,
    source: row.source,
  }));
}

async function getPlaidSyncTimes(userId: string): Promise<Record<string, string | null>> {
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("books_plaid_items")
    .select("id, last_synced_at, status")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const map: Record<string, string | null> = {};
  for (const item of data ?? []) map[item.id] = item.status === "active" ? item.last_synced_at : null;
  return map;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string | null;
  merchant: string | null;
  amount: number | null;
  transaction_type: string | null;
  financial_account_id: string | null;
  metadata: Record<string, unknown> | null;
}

async function loadTransactions(userId: string, accountIds: string[], since: string): Promise<TransactionRow[]> {
  if (!accountIds.length) return [];
  const supabase = createServiceRoleClient() as any;
  const rows: TransactionRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("books_transactions")
      .select("id, date, description, merchant, amount, transaction_type, financial_account_id, is_transfer, metadata")
      .eq("user_id", userId)
      .eq("is_transfer", false)
      .in("financial_account_id", accountIds)
      .gte("date", since)
      .order("date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as TransactionRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

interface DetectionGroup {
  direction: "income" | "expense";
  normalized: string;
  bucketAmount: number;
  txns: Array<{ row: TransactionRow; amount: number }>;
}

function groupTransactions(rows: TransactionRow[]): Map<string, DetectionGroup> {
  const groups = new Map<string, DetectionGroup>();
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    if (!amount || !row.financial_account_id) continue;
    const direction = row.transaction_type === "credit" || amount > 0 ? "income" : "expense";
    const normalized = normalizeMerchant(row.merchant) || normalizeMerchant(row.description);
    if (!normalized) continue;
    const bucketAmount = Math.round(Math.abs(amount) / 5) * 5;
    const key = `${direction}|${normalized}|${bucketAmount}`;
    const group = groups.get(key) ?? { direction, normalized, bucketAmount, txns: [] };
    group.txns.push({ row, amount: Math.abs(amount) });
    groups.set(key, group);
  }
  return groups;
}

/**
 * Classify an expense group as a card payment or internal transfer when its
 * transactions pair with opposite-sign credits on non-spending accounts by
 * exact amount within ±3 days. Amount+date pairing is used instead of merchant
 * matching because Plaid descriptions differ between the two legs.
 */
function classifyInternalFlow(
  group: DetectionGroup,
  rows: TransactionRow[],
  roles: Map<string, CashflowRole>,
): { flowKind: RecurringFlowKind; counterpartyAccountIds: string[] } | null {
  const creditIndex = new Map<number, Array<{ date: string; accountId: string; role: CashflowRole }>>();
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    const role = roles.get(row.financial_account_id ?? "");
    if (!role || role === "spending_source" || role === "ignore") continue;
    if (row.transaction_type !== "credit" && amount <= 0) continue;
    if (!amount) continue;
    const key = toCents(Math.abs(amount));
    const arr = creditIndex.get(key) ?? [];
    arr.push({ date: String(row.date), accountId: row.financial_account_id!, role });
    creditIndex.set(key, arr);
  }
  const pairedAccounts = new Set<string>();
  let pairs = 0;
  for (const txn of group.txns) {
    const key = toCents(txn.amount);
    const match = (creditIndex.get(key) ?? []).find(
      (c) => Math.abs(Math.round((parseDate(c.date).getTime() - parseDate(String(txn.row.date)).getTime()) / DAY_MS)) <= 3,
    );
    if (match) {
      pairs++;
      pairedAccounts.add(match.accountId);
    }
  }
  if (pairs < 2 || pairs * 2 < group.txns.length) return null;
  const pairedRoles = [...pairedAccounts].map((id) => roles.get(id)!);
  const flowKind: RecurringFlowKind = pairedRoles.some((r) => r === "credit_liability" || r === "loan")
    ? "card_payment"
    : "internal_transfer";
  return { flowKind, counterpartyAccountIds: [...pairedAccounts] };
}

function detectRecurringItemsFromRows(rows: TransactionRow[], roles: Map<string, CashflowRole>, today: string): RecurringItem[] {
  const groups = groupTransactions(rows);
  const recurring: RecurringItem[] = [];

  for (const [key, group] of groups) {
    if (group.txns.length < 3) continue;
    const dates = group.txns.map((t) => String(t.row.date)).sort((a, b) => a.localeCompare(b));
    const cadence = detectCadence(dates);
    if (!cadence) continue;

    const [direction, normalized] = key.split("|");
    const amounts = group.txns.map((t) => t.amount);
    const avgAmount = median(amounts);
    const lastSeenDate = dates[dates.length - 1];
    const schedule = { cadence: cadence.cadence, anchorDate: lastSeenDate, anchorDaysOfMonth: cadence.anchorDaysOfMonth };
    const nextExpectedDate = nextOccurrenceOnOrAfter(schedule, today);

    const accountIds = [...new Set(group.txns.map((t) => t.row.financial_account_id!))];
    const accountRoleSet = new Set(accountIds.map((id) => roles.get(id)));
    const hasSpending = accountRoleSet.has("spending_source");

    let flowKind: RecurringFlowKind = "standard";
    let counterpartyAccountIds: string[] | undefined;
    if (group.direction === "expense" && hasSpending) {
      const match = classifyInternalFlow(group, rows, roles);
      if (match) {
        flowKind = match.flowKind;
        counterpartyAccountIds = match.counterpartyAccountIds;
      }
    }

    const medianDeviation = median(amounts.map((a) => Math.abs(a - avgAmount)));
    const amountStability = avgAmount > 0 ? Math.max(0, 1 - medianDeviation / avgAmount) : 0;
    const confidence = Math.min(0.98, Math.max(0.5, cadence.regularity * 0.65 + amountStability * 0.25 + Math.min(group.txns.length, 6) / 60));

    recurring.push({
      id: Buffer.from(key).toString("base64url").slice(0, 24),
      merchant: group.txns.find((t) => t.row.merchant)?.row.merchant ?? normalized,
      descriptionPattern: normalized,
      averageAmount: +avgAmount.toFixed(2),
      direction: direction as "income" | "expense",
      cadence: cadence.cadence,
      nextExpectedDate,
      confidence: +confidence.toFixed(2),
      accountIds,
      transactionIds: group.txns.map((t) => t.row.id),
      lastSeenDate,
      anchorDaysOfMonth: cadence.anchorDaysOfMonth,
      flowKind,
      counterpartyAccountIds,
      stableKey: key,
      confirmed: false,
      included: true,
      source: "detected",
      isSubscription: looksLikeSubscription({
        direction: group.direction,
        descriptionPattern: normalized,
        cadence: cadence.cadence,
        amountCents: toCents(avgAmount),
        flowKind,
      }),
    });
  }

  return recurring.sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate));
}

async function getDetectionContext(userId: string, lookbackDays: number) {
  const accountRows = await getAccountRows(userId);
  const roles = new Map<string, CashflowRole>();
  const includedIds: string[] = [];
  for (const row of accountRows) {
    const role = (row.cashflow_role ?? defaultRole(row.account_type ?? "other")) as CashflowRole;
    roles.set(row.id, role);
    if (row.cashflow_include !== false && role !== "ignore") includedIds.push(row.id);
  }
  const since = addDays(isoDate(), -lookbackDays);
  const rows = await loadTransactions(userId, includedIds, since);
  const fallbackAccountId = primarySpendingAccount(accountRows);
  return { accountRows, roles, includedIds, rows, since, fallbackAccountId };
}

function primarySpendingAccount(accountRows: AccountRow[]): string | null {
  const spending = accountRows
    .filter((r) => (r.cashflow_role ?? defaultRole(r.account_type ?? "other")) === "spending_source" && r.cashflow_include !== false)
    .map((r) => ({ id: r.id, cents: toCents(r.available_balance ?? r.current_balance ?? 0) }))
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));
  return spending[0]?.id ?? null;
}

async function getMergedRecurringItems(userId: string, roles: Map<string, CashflowRole>, rows: TransactionRow[], today: string, fallbackAccountId: string | null): Promise<RecurringItem[]> {
  const proposals = detectRecurringItemsFromRows(rows, roles, today);
  const persisted = await loadPersistedRecurring(userId);
  return mergeRecurringItems(proposals, persisted, today, fallbackAccountId);
}

export async function detectRecurringItems(userId: string, lookbackDays = DETECTION_LOOKBACK_DAYS): Promise<RecurringItem[]> {
  const { roles, rows, fallbackAccountId } = await getDetectionContext(userId, lookbackDays);
  return getMergedRecurringItems(userId, roles, rows, isoDate(), fallbackAccountId);
}

interface CashflowSettings {
  bufferCents: number;
  essentialWeeklyAllowanceCents: number | null;
  emergencyTargetMonths: number | null;
}

async function getCashflowSettings(userId: string, monthlyRecurringExpenseCents: number): Promise<CashflowSettings> {
  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from("user_settings")
    .select("minimum_cash_buffer, essential_weekly_allowance, emergency_target_months")
    .eq("user_id", userId)
    .maybeSingle();
  const bufferConfigured = data?.minimum_cash_buffer;
  const bufferCents = bufferConfigured == null
    ? Math.max(25000, Math.round(monthlyRecurringExpenseCents * 0.1))
    : toCents(Number(bufferConfigured));
  const allowanceConfigured = data?.essential_weekly_allowance;
  const essentialWeeklyAllowanceCents = allowanceConfigured == null ? null : toCents(Number(allowanceConfigured));
  const emergencyTargetMonths = data?.emergency_target_months == null ? null : Number(data.emergency_target_months);
  return { bufferCents, essentialWeeklyAllowanceCents, emergencyTargetMonths };
}

interface LoadedInput {
  input: CalcInput;
  accounts: CashflowAccount[];
  recurringItems: RecurringItem[];
  minimumBufferCents: number;
  balanceAsOf: string | null;
  balanceStale: boolean;
  missingInputs: string[];
  emergencyTargetMonths: number | null;
  timezone: string | null;
  cashboardAccounts: CashboardAccountInput[];
  receipts: CashboardReceipt[];
  review: { count: number; debitCents: number; creditCents: number };
  essentialMonthlyCommitmentsCents: number | null;
}

interface PassiveReceiptRow {
  transaction_id: string;
  kind: string;
  source: "unknown" | "provider" | "rule" | "user";
}

async function loadPassiveReceipts(userId: string): Promise<CashboardReceipt[]> {
  const supabase = createServiceRoleClient() as any;
  const { data: interps, error } = await supabase
    .from("books_transaction_interpretations")
    .select("transaction_id, kind, source")
    .eq("user_id", userId)
    .eq("kind", "passive_income");
  if (error) throw new Error(error.message);
  const rows = (interps ?? []) as PassiveReceiptRow[];
  if (!rows.length) return [];

  const byId = new Map(rows.map((r) => [r.transaction_id, r]));
  const { data: txns, error: txError } = await supabase
    .from("books_transactions")
    .select("id, date, description, merchant, amount, financial_account_id, provider_data, metadata")
    .in("id", [...byId.keys()]);
  if (txError) throw new Error(txError.message);

  return (txns ?? []).map((tx: any) => {
    const interp = byId.get(tx.id)!;
    return {
      id: tx.id,
      date: String(tx.date),
      label: tx.merchant ?? tx.description ?? "Receipt",
      amountCents: toCents(tx.amount),
      accountId: tx.financial_account_id ?? "",
      kind: "passive_income",
      pending: tx.provider_data?.pending === true || tx.metadata?.pending === true,
      confirmed: interp.source === "user" || interp.source === "rule",
    } satisfies CashboardReceipt;
  });
}

async function loadReviewSummary(userId: string): Promise<{ count: number; debitCents: number; creditCents: number }> {
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase.rpc("consumer_review_summary", {
    p_user_id: userId,
    p_account_id: null,
  });
  if (error) throw new Error(error.message);
  return {
    count: Number(data?.count ?? 0),
    debitCents: Number(data?.debitCents ?? 0),
    creditCents: Number(data?.creditCents ?? 0),
  };
}

async function buildCalcInput(userId: string, horizonDays: number, scenarios: CalcScenario[]): Promise<LoadedInput> {
  const timezone = await getUserTimezone(userId);
  const today = localCalendarDate(new Date().toISOString(), timezone ?? "America/New_York").today;
  const accountRows = await getAccountRows(userId);
  const syncTimes = await getPlaidSyncTimes(userId);

  const accounts: CashflowAccount[] = [];
  const calcAccounts: CalcAccount[] = [];
  const cashboardAccounts: CashboardAccountInput[] = [];
  const roles = new Map<string, CashflowRole>();
  const includedIds: string[] = [];

  for (const row of accountRows) {
    const role = (row.cashflow_role ?? defaultRole(row.account_type ?? "other")) as CashflowRole;
    roles.set(row.id, role);
    const included = row.cashflow_include !== false && role !== "ignore";
    if (included) includedIds.push(row.id);
    const balanceAsOf = (row.plaid_item_id ? syncTimes[row.plaid_item_id] : null) ?? row.updated_at;
    const spendableDollars = row.available_balance ?? row.current_balance;
    const spendableCents = spendableDollars == null ? null : toCents(spendableDollars);
    accounts.push({
      id: row.id,
      name: row.name,
      accountType: row.account_type ?? "other",
      currentBalance: row.current_balance == null ? 0 : toDollars(toCents(row.current_balance)),
      role,
      included: row.cashflow_include !== false,
      availableBalance: row.available_balance == null ? null : toDollars(toCents(row.available_balance)),
      balanceAsOf,
      isEmergency: !!row.is_emergency && role === "reserve",
    });
    calcAccounts.push({
      id: row.id,
      role,
      included,
      spendableCents,
      currentBalanceCents: row.current_balance == null ? null : toCents(row.current_balance),
      balanceAsOf,
      isEmergency: !!row.is_emergency && role === "reserve",
      currencyCode: row.currency_code ?? null,
    });
    cashboardAccounts.push({
      id: row.id,
      name: row.name,
      role,
      accountType: row.account_type ?? "other",
      included,
      currencyCode: row.currency_code ?? null,
      currentBalanceCents: row.current_balance == null ? null : toCents(row.current_balance),
      spendableCents,
      availableKnown: row.available_balance != null,
      balanceAsOf,
      isEmergency: !!row.is_emergency && role === "reserve",
      pendingDebitCents: 0,
    });
  }

  const since = addDays(today, -DETECTION_LOOKBACK_DAYS);
  const txRows = await loadTransactions(userId, includedIds, since);
  const includedIdSet = new Set(includedIds);
  const observed: CalcObservedTxn[] = txRows.map((row) => {
    const role = roles.get(row.financial_account_id ?? "") ?? "ignore";
    return {
      date: String(row.date),
      amountCents: row.transaction_type === "credit" ? toCents(Math.abs(Number(row.amount ?? 0))) : -toCents(Math.abs(Number(row.amount ?? 0))),
      accountId: row.financial_account_id ?? "",
      accountRole: role,
      accountIncluded: includedIdSet.has(row.financial_account_id ?? ""),
      pending: (row.metadata as any)?.pending === true,
    };
  });

  const fallbackAccountId = primarySpendingAccount(accountRows);
  const recurringItems = await getMergedRecurringItems(userId, roles, txRows, today, fallbackAccountId);
  const calcRecurring: CalcRecurringItem[] = recurringItems.map((item) => {
    const accountRoleSet = new Set(item.accountIds.map((id) => roles.get(id)).filter(Boolean));
    const hasSpending = accountRoleSet.has("spending_source");
    return {
      id: item.id,
      merchant: item.merchant,
      amountCents: toCents(item.averageAmount),
      direction: item.direction,
      cadence: item.cadence,
      anchorDate: item.lastSeenDate,
      anchorDaysOfMonth: item.anchorDaysOfMonth,
      accountIds: item.accountIds,
      flowKind: item.flowKind ?? "standard",
      cashEffect: hasSpending,
      landsOnSpendable: hasSpending,
      included: item.included !== false,
      confirmed: !!item.confirmed,
    };
  });

  const monthlyRecurringExpenseCents = calcRecurring
    .filter((i) => i.direction === "expense" && i.included)
    .reduce((sum, i) => sum + monthlyEquivalentCents(i.amountCents, i.cadence), 0);
  const settings = await getCashflowSettings(userId, monthlyRecurringExpenseCents);
  const bufferCents = settings.bufferCents;

  // Cushion denominator: monthly equivalent of included standard recurring cash
  // outflows (null when there are none — never a confident zero).
  let essentialMonthlyCommitmentsCents: number | null = null;
  for (const item of calcRecurring) {
    if (item.direction !== "expense" || !item.included || item.flowKind !== "standard" || !item.cashEffect) continue;
    essentialMonthlyCommitmentsCents =
      (essentialMonthlyCommitmentsCents ?? 0) + monthlyEquivalentCents(item.amountCents, item.cadence);
  }

  let historyDays = 0;
  let historyComplete = false;
  if (txRows.length) {
    const earliest = txRows.reduce((min, r) => (String(r.date) < min ? String(r.date) : min), String(txRows[0].date));
    historyDays = Math.max(0, Math.round((parseDate(today).getTime() - parseDate(earliest).getTime()) / DAY_MS));
    historyComplete = earliest <= since;
  }
  const pendingRows = observed.filter((t) => t.pending);
  const pendingNetCents = pendingRows.reduce((s, t) => s + t.amountCents, 0);
  const pendingDebitsByAccount = new Map<string, number>();
  for (const t of pendingRows) {
    if (t.amountCents < 0) pendingDebitsByAccount.set(t.accountId, (pendingDebitsByAccount.get(t.accountId) ?? 0) + -t.amountCents);
  }
  for (const a of cashboardAccounts) a.pendingDebitCents = pendingDebitsByAccount.get(a.id) ?? 0;

  const [receipts, review] = await Promise.all([loadPassiveReceipts(userId), loadReviewSummary(userId)]);

  const spendingCalcAccounts = calcAccounts.filter((a) => a.included && a.role === "spending_source" && a.spendableCents != null);
  const balanceAsOfValues = spendingCalcAccounts.map((a) => a.balanceAsOf).filter((v): v is string => !!v);
  const balanceAsOf = balanceAsOfValues.length ? balanceAsOfValues.reduce((min, v) => (v < min ? v : min)) : null;
  const balanceStale = spendingCalcAccounts.length > 0 && spendingCalcAccounts.some((a) => isBalanceStale(a.balanceAsOf));

  const missingInputs: string[] = [];
  if (settings.essentialWeeklyAllowanceCents == null) missingInputs.push("essential_allowance");
  const { paydayDate, provisional } = selectPayday(
    calcRecurring
      .filter((i) => i.included)
      .map((i) => ({
        nextDate: nextOccurrenceOnOrAfter(i, today),
        cadence: i.cadence,
        confirmed: i.confirmed,
        landsOnSpendable: i.landsOnSpendable,
        direction: i.direction,
      })),
    today,
  );
  if (!paydayDate) missingInputs.push("confirmed_payday");

  const input: CalcInput = {
    today,
    horizonDays,
    bufferCents,
    accounts: calcAccounts,
    recurring: calcRecurring,
    essentialWeeklyAllowanceCents: settings.essentialWeeklyAllowanceCents,
    scenarios,
    paydayDate,
    paydayProvisional: provisional,
    observed,
    dataQuality: {
      historyDays,
      historyComplete,
      accountsIncluded: includedIds.length,
      accountsExcluded: accountRows.length - includedIds.length,
      pendingCount: pendingRows.length,
      pendingNetCents,
    },
  };

  return {
    input,
    accounts,
    recurringItems,
    minimumBufferCents: bufferCents,
    balanceAsOf,
    balanceStale,
    missingInputs,
    emergencyTargetMonths: settings.emergencyTargetMonths,
    timezone,
    cashboardAccounts,
    receipts,
    review,
    essentialMonthlyCommitmentsCents,
  };
}

function simItemToForecastItem(item: SimItem): ForecastItem {
  return {
    id: item.id,
    date: item.date,
    label: item.label,
    amount: toDollars(item.amountCents),
    direction: item.direction,
    recurringItemId: item.recurringItemId,
    accountId: item.accountId,
  };
}

function mapForecast(input: CalcInput, sim: ReturnType<typeof simulate>): CashflowForecast {
  return {
    today: input.today,
    horizonDays: input.horizonDays,
    currentSpendableBalance: toDollars(sim.openingCents),
    projectedLowBalance: toDollars(sim.lowCents),
    projectedEndBalance: toDollars(sim.endCents),
    upcomingIncome: sim.upcomingIncome.map(simItemToForecastItem),
    upcomingExpenses: sim.upcomingExpenses.map(simItemToForecastItem),
    dailyBalances: sim.days.map((d) => ({
      date: d.date,
      projectedBalance: toDollars(d.totalCents),
      items: d.items.map(simItemToForecastItem),
    })),
    projectedLowDate: sim.lowDate,
    perAccountLowBalances: Object.fromEntries(Object.entries(sim.perAccountLow).map(([id, v]) => [id, toDollars(v.cents)])),
  };
}

export async function getCashflowForecast(userId: string, horizonDays = 30, extraItems: ForecastItem[] = []): Promise<{ forecast: CashflowForecast; accounts: CashflowAccount[]; recurringItems: RecurringItem[]; minimumBuffer: number }> {
  const h = clampHorizonDays(horizonDays);
  const scenarios: CalcScenario[] = extraItems.map((item, i) => ({
    id: item.id || `extra-${i}`,
    type: "purchase",
    amountCents: toCents(item.amount),
    date: item.date,
    label: item.label,
  }));
  const loaded = await buildCalcInput(userId, h, scenarios);
  const result = computeCashflow(loaded.input);
  return {
    forecast: mapForecast(loaded.input, result.sim),
    accounts: loaded.accounts,
    recurringItems: loaded.recurringItems,
    minimumBuffer: toDollars(loaded.minimumBufferCents),
  };
}

function assembleCashflowSnapshot(
  loaded: LoadedInput,
  result: ReturnType<typeof computeCashflow>
): CashflowSnapshot {
  const bufferDollars = toDollars(loaded.minimumBufferCents);
  const forecast = mapForecast(loaded.input, result.sim);

  const safeToSpend = Math.max(0, result.risk.lowCents - loaded.minimumBufferCents);
  const dataQuality: CashflowDataQuality = {
    balanceAsOf: loaded.balanceAsOf,
    balanceStale: loaded.balanceStale,
    historyDays: loaded.input.dataQuality.historyDays,
    historyComplete: loaded.input.dataQuality.historyComplete,
    accountsIncluded: loaded.input.dataQuality.accountsIncluded,
    accountsExcluded: loaded.input.dataQuality.accountsExcluded,
    pendingCount: loaded.input.dataQuality.pendingCount,
    pendingNet: toDollars(loaded.input.dataQuality.pendingNetCents),
    missingInputs: loaded.missingInputs,
  };
  const monthlyMargins: MonthlyMargin[] = result.margins.map((m) => ({
    month: m.month,
    through: m.through,
    partialMonth: m.partialMonth,
    income: toDollars(m.incomeCents),
    expenses: toDollars(m.expenseCents),
    margin: toDollars(m.marginCents),
    savingsAllocations: toDollars(m.savingsAllocationCents),
    cardPayments: toDollars(m.cardPaymentCents),
    comparableMargin: m.comparableMarginCents === undefined ? undefined : toDollars(m.comparableMarginCents),
  }));
  const cushion: EmergencyCushion = {
    reserveBalance: toDollars(result.cushion.reserveCents),
    essentialMonthlyOutflows: result.cushion.essentialMonthlyCents == null ? null : toDollars(result.cushion.essentialMonthlyCents),
    months: result.cushion.months,
    estimated: result.cushion.estimated,
    targetMonths: loaded.emergencyTargetMonths,
  };
  const assumptions = [
    "Only accounts marked as spending sources count as spendable cash.",
    "Internal transfers are excluded from recurring cash-flow detection.",
    "Recurring income and bills are inferred from transaction history and may need review.",
    "Spendable cash uses the available balance when the institution provides one, otherwise the current balance.",
    "Income counts toward margins when it lands in an included spending account.",
    "Essential outflows are estimated from detected recurring bills until an everyday-spending allowance is confirmed.",
  ];

  return {
    accounts: loaded.accounts,
    recurringItems: loaded.recurringItems,
    forecast,
    minimumBuffer: bufferDollars,
    safeToSpend: toDollars(safeToSpend),
    nextIncomeDate: forecast.upcomingIncome[0]?.date ?? null,
    assumptions,
    dataQuality,
    paydayWindow: {
      nextPayday: result.paydayWindow.nextPayday,
      end: result.paydayWindow.end,
      provisional: result.paydayWindow.provisional,
    },
    availableUntilPayday: result.availability ? toDollars(result.availability.availableCents) : null,
    cashRisk: {
      lowBalance: toDollars(result.risk.lowCents),
      lowDate: result.risk.lowDate,
      minimumBuffer: bufferDollars,
      shortfall: toDollars(result.risk.shortfallCents),
      firstBelowBufferDate: result.risk.firstBelowBufferDate,
      firstNegativeDate: result.risk.firstNegativeDate,
      causes: result.risk.causes.map(simItemToForecastItem),
    },
    monthlyMargins,
    emergencyCushion: cushion,
    netWorth: {
      assets: toDollars(result.netWorth.assetCents),
      liabilities: toDollars(result.netWorth.liabilityCents),
      net: toDollars(result.netWorth.netCents),
      accountsIncluded: result.netWorth.accountsIncluded,
      accountsMissingBalance: result.netWorth.accountsMissingBalance,
    },
  };
}

export async function getCashflowSnapshot(userId: string, horizonDays = 30): Promise<CashflowSnapshot> {
  const loaded = await buildCalcInput(userId, clampHorizonDays(horizonDays), []);
  return assembleCashflowSnapshot(loaded, computeCashflow(loaded.input));
}

function buildScheduledFlows(input: CalcInput, windowEnd: string): CashboardScheduledFlow[] {
  const flows: CashboardScheduledFlow[] = [];
  for (const item of input.recurring) {
    if (!item.included) continue;
    if (item.direction === "expense" && !item.cashEffect) continue;
    if (item.direction === "income" && !item.landsOnSpendable) continue;
    const kind: CashboardScheduledFlow["kind"] =
      item.flowKind === "internal_transfer" ? "savings_transfer" : item.flowKind === "card_payment" ? "card_payment" : item.direction === "income" ? "income" : "bill";
    for (const date of expandOccurrences(item, input.today, windowEnd)) {
      flows.push({
        id: `${item.id}-${date}`,
        date,
        label: item.merchant,
        amountCents: item.amountCents,
        direction: item.direction,
        consumesSpendingCash: item.direction === "expense",
        kind,
        accountId: item.accountIds[0],
      });
    }
  }
  if (input.essentialWeeklyAllowanceCents && input.essentialWeeklyAllowanceCents > 0) {
    for (let i = 0; i <= input.horizonDays; i++) {
      const date = addDays(input.today, i);
      if (date > windowEnd) break;
      if (parseDate(date).getUTCDay() === 1) {
        flows.push({
          id: `allowance-${date}`,
          date,
          label: "Everyday spending",
          amountCents: input.essentialWeeklyAllowanceCents,
          direction: "expense",
          consumesSpendingCash: true,
          kind: "allowance",
        });
      }
    }
  }
  return flows;
}

export async function getCashboardSnapshot(userId: string): Promise<CashboardSnapshot> {
  const loaded = await buildCalcInput(userId, clampHorizonDays(30), []);
  const result = computeCashflow(loaded.input);
  const cashflow = assembleCashflowSnapshot(loaded, result);
  const windowEnd = result.paydayWindow.end;
  const asOf = new Date().toISOString();
  const timezone = loaded.timezone ?? "America/New_York";

  const { metrics, warnings } = buildCashboardMetrics({
    asOf,
    timezone,
    today: loaded.input.today,
    monthStart: `${loaded.input.today.slice(0, 7)}-01`,
    accounts: loaded.cashboardAccounts,
    scheduledFlows: buildScheduledFlows(loaded.input, windowEnd),
    windowEnd,
    payday: { nextPayday: result.paydayWindow.nextPayday, provisional: result.paydayWindow.provisional },
    bufferCents: loaded.minimumBufferCents,
    essentialWeeklyAllowanceCents: loaded.input.essentialWeeklyAllowanceCents,
    essentialMonthlyCommitmentsCents: loaded.essentialMonthlyCommitmentsCents,
    receipts: loaded.receipts,
    unresolvedPositiveCents: loaded.review.creditCents,
    review: loaded.review,
    thirtyDayShortfallCents: Math.max(0, result.risk.shortfallCents),
    staleBeforeMs: Date.now() - 48 * 3_600_000,
  });

  return {
    version: 1,
    asOf,
    timezone,
    currency: "USD",
    metrics,
    cashflow,
    review: loaded.review,
    warnings,
  };
}

export async function checkAffordability(userId: string, params: { amount: number; description?: string; date?: string; horizonDays?: number; scenarioType?: "purchase" | "savings_transfer"; reserveAccountId?: string }): Promise<AffordabilityResult> {
  const requestedAmount = Math.max(0, Number(params.amount ?? 0));
  const horizonDays = clampHorizonDays(params.horizonDays ?? 30);
  const today = isoDate();
  const horizonEnd = addDays(today, horizonDays);
  const purchaseDate = params.date ?? today;
  if (!isValidISODate(purchaseDate) || purchaseDate < today || purchaseDate > horizonEnd) {
    throw new Error(`purchaseDate must be a valid date between ${today} and ${horizonEnd}`);
  }
  const scenarioType = params.scenarioType === "savings_transfer" ? "savings_transfer" : "purchase";
  const scenarioId = scenarioType === "savings_transfer" ? "planned-transfer" : "planned-purchase";
  const scenarioLabel = params.description || (scenarioType === "savings_transfer" ? "Transfer to savings" : "Planned purchase");

  const scenario: CalcScenario = {
    id: scenarioId,
    type: scenarioType,
    amountCents: toCents(requestedAmount),
    date: purchaseDate,
    label: scenarioLabel,
  };
  const loaded = await buildCalcInput(userId, horizonDays, [scenario]);

  if (scenarioType === "savings_transfer") {
    const reserve = params.reserveAccountId
      ? loaded.accounts.find((a) => a.id === params.reserveAccountId && a.role === "reserve" && a.included)
      : null;
    if (!reserve) {
      throw new Error("reserveAccountId must be an included reserve account in your plan");
    }
    scenario.reserveAccountId = reserve.id;
  }

  const after = computeCashflow(loaded.input);
  const beforeInput: CalcInput = { ...loaded.input, scenarios: [] };
  const before = computeCashflow(beforeInput);

  const bufferCents = loaded.minimumBufferCents;
  const safeBeforeCents = Math.max(0, before.risk.lowCents - bufferCents);
  const safeAfterCents = after.risk.lowCents - bufferCents;
  const status: AffordabilityResult["status"] = safeAfterCents >= 10000
    ? "yes"
    : safeAfterCents >= 0
      ? "caution"
      : "no";

  const blockingObligations = after.sim.upcomingExpenses
    .filter((item) => item.id !== scenarioId)
    .slice(0, 5)
    .map(simItemToForecastItem);
  const keyReasons = [
    `Available to spend before this change is $${toDollars(safeBeforeCents).toFixed(2)}.`,
    `After, projected low balance is $${toDollars(after.risk.lowCents).toFixed(2)} against a $${toDollars(bufferCents).toFixed(2)} buffer.`,
  ];
  if (scenarioType === "savings_transfer") {
    keyReasons.push("A transfer to savings reduces spending cash but increases your emergency reserve — this is money moved, not money spent.");
  } else {
    keyReasons.push("A purchase reduces spending cash only — your emergency reserve is not automatically consumed.");
  }
  if (blockingObligations.length) {
    keyReasons.push(`Upcoming obligations include ${blockingObligations.slice(0, 3).map((i) => `${i.label} on ${i.date}`).join(", ")}.`);
  }
  const nextIncomeDate = before.sim.upcomingIncome[0]?.date;
  if (!nextIncomeDate) keyReasons.push("No recurring income was confidently detected in the forecast horizon.");

  const essentialsCents = before.cushion.essentialMonthlyCents;
  const reserveBeforeCents = before.cushion.reserveCents;
  const reserveAfterCents = scenarioType === "savings_transfer" ? reserveBeforeCents + toCents(requestedAmount) : reserveBeforeCents;
  const cushionBefore = computeCushion(reserveBeforeCents, essentialsCents);
  const cushionAfter = computeCushion(reserveAfterCents, essentialsCents);
  const cushionToResult = (c: ReturnType<typeof computeCushion>): EmergencyCushion => ({
    reserveBalance: toDollars(c.reserveCents),
    essentialMonthlyOutflows: c.essentialMonthlyCents == null ? null : toDollars(c.essentialMonthlyCents),
    months: c.months,
    estimated: c.estimated,
    targetMonths: loaded.emergencyTargetMonths,
  });

  const dataQuality: CashflowDataQuality = {
    balanceAsOf: loaded.balanceAsOf,
    balanceStale: loaded.balanceStale,
    historyDays: loaded.input.dataQuality.historyDays,
    historyComplete: loaded.input.dataQuality.historyComplete,
    accountsIncluded: loaded.input.dataQuality.accountsIncluded,
    accountsExcluded: loaded.input.dataQuality.accountsExcluded,
    pendingCount: loaded.input.dataQuality.pendingCount,
    pendingNet: toDollars(loaded.input.dataQuality.pendingNetCents),
    missingInputs: loaded.missingInputs,
  };

  return {
    status,
    requestedAmount,
    description: params.description,
    purchaseDate,
    safeToSpendBeforePurchase: toDollars(safeBeforeCents),
    safeToSpendAfterPurchase: toDollars(safeAfterCents),
    currentSpendableBalance: toDollars(before.sim.openingCents),
    projectedLowBalanceAfterPurchase: toDollars(after.risk.lowCents),
    minimumBuffer: toDollars(bufferCents),
    horizonDays,
    keyReasons,
    blockingObligations,
    suggestedMaxPurchase: toDollars(safeBeforeCents),
    forecast: mapForecast(loaded.input, after.sim),
    dataQuality,
    availableUntilPaydayBefore: before.availability ? toDollars(before.availability.availableCents) : null,
    availableUntilPaydayAfter: after.availability ? toDollars(after.availability.availableCents) : null,
    cashRiskAfter: {
      lowBalance: toDollars(after.risk.lowCents),
      lowDate: after.risk.lowDate,
      minimumBuffer: toDollars(bufferCents),
      shortfall: toDollars(after.risk.shortfallCents),
      firstBelowBufferDate: after.risk.firstBelowBufferDate,
      firstNegativeDate: after.risk.firstNegativeDate,
      causes: after.risk.causes.map(simItemToForecastItem),
    },
    scenario: {
      type: scenarioType,
      amount: requestedAmount,
      date: purchaseDate,
      label: scenarioLabel,
      reserveAccountId: scenarioType === "savings_transfer" ? (params.reserveAccountId ?? null) : null,
    },
    projectedLowBalanceBeforePurchase: toDollars(before.risk.lowCents),
    projectedLowBeforeDate: before.risk.lowDate,
    emergencyCushionBefore: cushionToResult(cushionBefore),
    emergencyCushionAfter: cushionToResult(cushionAfter),
  };
}
