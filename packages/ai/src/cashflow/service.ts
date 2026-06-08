import { createServiceRoleClient } from "@cashpile/db";
import type {
  AffordabilityResult,
  CashflowAccount,
  CashflowForecast,
  CashflowRole,
  CashflowSnapshot,
  ForecastItem,
  RecurringCadence,
  RecurringItem,
} from "./types";

const DAY_MS = 86_400_000;

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00.000Z`).getTime() - new Date(`${a}T00:00:00.000Z`).getTime()) / DAY_MS);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

function cadenceFromIntervals(intervals: number[]): { cadence: RecurringCadence; days: number; regularity: number } {
  const med = median(intervals);
  const candidates: Array<{ cadence: RecurringCadence; days: number }> = [
    { cadence: "weekly", days: 7 },
    { cadence: "biweekly", days: 14 },
    { cadence: "monthly", days: 30 },
    { cadence: "quarterly", days: 91 },
    { cadence: "annual", days: 365 },
  ];
  const best = candidates
    .map((c) => ({ ...c, diff: Math.abs(med - c.days) }))
    .sort((a, b) => a.diff - b.diff)[0];
  const tolerance = Math.max(3, best.days * 0.2);
  const regular = intervals.filter((i) => Math.abs(i - best.days) <= tolerance).length;
  const regularity = intervals.length ? regular / intervals.length : 0;
  if (best.diff > tolerance || regularity < 0.5) return { cadence: "irregular", days: Math.max(30, Math.round(med || 30)), regularity };
  return { cadence: best.cadence, days: best.days, regularity };
}

function cadenceDays(cadence: RecurringCadence) {
  switch (cadence) {
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
    case "quarterly": return 91;
    case "annual": return 365;
    default: return 30;
  }
}

function monthlyEquivalent(amount: number, cadence: RecurringCadence) {
  switch (cadence) {
    case "weekly": return amount * 52 / 12;
    case "biweekly": return amount * 26 / 12;
    case "monthly": return amount;
    case "quarterly": return amount / 3;
    case "annual": return amount / 12;
    default: return 0;
  }
}

async function getAccounts(userId: string): Promise<CashflowAccount[]> {
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("books_financial_accounts")
    .select("id, name, account_type, current_balance, cashflow_role, cashflow_include, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    accountType: a.account_type ?? "other",
    currentBalance: Number(a.current_balance ?? 0),
    role: (a.cashflow_role ?? defaultRole(a.account_type ?? "other")) as CashflowRole,
    included: a.cashflow_include !== false,
  }));
}

export async function detectRecurringItems(userId: string, lookbackDays = 365): Promise<RecurringItem[]> {
  const supabase = createServiceRoleClient() as any;
  const since = addDays(isoDate(), -lookbackDays);
  const { data, error } = await supabase
    .from("books_transactions")
    .select("id, date, description, merchant, amount, transaction_type, financial_account_id, is_transfer")
    .eq("user_id", userId)
    .eq("is_transfer", false)
    .gte("date", since)
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);

  const groups = new Map<string, any[]>();
  for (const tx of data ?? []) {
    const amount = Number(tx.amount ?? 0);
    if (!amount) continue;
    const direction = tx.transaction_type === "credit" || amount > 0 ? "income" : "expense";
    const normalized = normalizeMerchant(tx.merchant) || normalizeMerchant(tx.description);
    if (!normalized) continue;
    const bucketAmount = Math.round(Math.abs(amount) / 5) * 5;
    const key = `${direction}|${normalized}|${bucketAmount}`;
    const arr = groups.get(key) ?? [];
    arr.push(tx);
    groups.set(key, arr);
  }

  const recurring: RecurringItem[] = [];
  for (const [key, txns] of groups) {
    if (txns.length < 3) continue;
    txns.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const intervals = txns.slice(1).map((t, i) => daysBetween(txns[i].date, t.date)).filter((d) => d > 0);
    if (!intervals.length) continue;
    const cadence = cadenceFromIntervals(intervals);
    if (cadence.cadence === "irregular") continue;

    const [direction, normalized] = key.split("|");
    const amounts = txns.map((t) => Math.abs(Number(t.amount ?? 0)));
    const avgAmount = median(amounts);
    const lastSeenDate = txns[txns.length - 1].date;
    let nextExpectedDate = addDays(lastSeenDate, cadence.days);
    while (nextExpectedDate < isoDate()) nextExpectedDate = addDays(nextExpectedDate, cadence.days);

    const amountStability = avgAmount > 0
      ? Math.max(0, 1 - median(amounts.map((a) => Math.abs(a - avgAmount))) / avgAmount)
      : 0;
    const confidence = Math.min(0.98, Math.max(0.5, cadence.regularity * 0.65 + amountStability * 0.25 + Math.min(txns.length, 6) / 60));

    recurring.push({
      id: Buffer.from(key).toString("base64url").slice(0, 24),
      merchant: txns.find((t) => t.merchant)?.merchant ?? normalized,
      descriptionPattern: normalized,
      averageAmount: +avgAmount.toFixed(2),
      direction: direction as "income" | "expense",
      cadence: cadence.cadence,
      nextExpectedDate,
      confidence: +confidence.toFixed(2),
      accountIds: Array.from(new Set(txns.map((t) => t.financial_account_id).filter(Boolean))),
      transactionIds: txns.map((t) => t.id),
      lastSeenDate,
    });
  }

  return recurring.sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate));
}

async function getMinimumBuffer(userId: string, recurringItems: RecurringItem[]) {
  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from("user_settings")
    .select("minimum_cash_buffer")
    .eq("user_id", userId)
    .maybeSingle();
  const configured = Number(data?.minimum_cash_buffer ?? 0);
  if (configured > 0) return configured;
  const monthlyExpenses = recurringItems
    .filter((item) => item.direction === "expense")
    .reduce((sum, item) => sum + monthlyEquivalent(item.averageAmount, item.cadence), 0);
  return +Math.max(250, monthlyExpenses * 0.1).toFixed(2);
}

function expandForecastItems(recurringItems: RecurringItem[], today: string, horizonDays: number): ForecastItem[] {
  const end = addDays(today, horizonDays);
  const items: ForecastItem[] = [];
  for (const item of recurringItems) {
    let date = item.nextExpectedDate;
    let n = 0;
    while (date <= end && n < 20) {
      if (date >= today) {
        items.push({
          id: `${item.id}-${date}`,
          date,
          label: item.merchant,
          amount: item.averageAmount,
          direction: item.direction,
          recurringItemId: item.id,
        });
      }
      date = addDays(date, cadenceDays(item.cadence));
      n++;
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

export async function getCashflowForecast(userId: string, horizonDays = 30, extraItems: ForecastItem[] = []): Promise<{ forecast: CashflowForecast; accounts: CashflowAccount[]; recurringItems: RecurringItem[]; minimumBuffer: number }> {
  const today = isoDate();
  const accounts = await getAccounts(userId);
  const recurringItems = await detectRecurringItems(userId);
  const minimumBuffer = await getMinimumBuffer(userId, recurringItems);
  const currentSpendableBalance = accounts
    .filter((a) => a.included && a.role === "spending_source")
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const items = [...expandForecastItems(recurringItems, today, horizonDays), ...extraItems]
    .sort((a, b) => a.date.localeCompare(b.date));
  let balance = currentSpendableBalance;
  let projectedLowBalance = balance;
  const dailyBalances: CashflowForecast["dailyBalances"] = [];
  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    const dayItems = items.filter((item) => item.date === date);
    for (const item of dayItems) {
      balance += item.direction === "income" ? item.amount : -item.amount;
    }
    projectedLowBalance = Math.min(projectedLowBalance, balance);
    dailyBalances.push({ date, projectedBalance: +balance.toFixed(2), items: dayItems });
  }

  const forecast: CashflowForecast = {
    today,
    horizonDays,
    currentSpendableBalance: +currentSpendableBalance.toFixed(2),
    projectedLowBalance: +projectedLowBalance.toFixed(2),
    projectedEndBalance: +balance.toFixed(2),
    upcomingIncome: items.filter((i) => i.direction === "income"),
    upcomingExpenses: items.filter((i) => i.direction === "expense"),
    dailyBalances,
  };
  return { forecast, accounts, recurringItems, minimumBuffer };
}

export async function getCashflowSnapshot(userId: string, horizonDays = 30): Promise<CashflowSnapshot> {
  const { forecast, accounts, recurringItems, minimumBuffer } = await getCashflowForecast(userId, horizonDays);
  const safeToSpend = Math.max(0, forecast.projectedLowBalance - minimumBuffer);
  const nextIncomeDate = forecast.upcomingIncome[0]?.date ?? null;
  const assumptions = [
    "Only accounts marked as spending sources count as spendable cash.",
    "Internal transfers are excluded from recurring cash-flow detection.",
    "Recurring income and bills are inferred from transaction history and may need review.",
  ];
  return {
    accounts,
    recurringItems,
    forecast,
    minimumBuffer,
    safeToSpend: +safeToSpend.toFixed(2),
    nextIncomeDate,
    assumptions,
  };
}

export async function checkAffordability(userId: string, params: { amount: number; description?: string; date?: string; horizonDays?: number }): Promise<AffordabilityResult> {
  const requestedAmount = Math.max(0, Number(params.amount ?? 0));
  const horizonDays = Math.min(90, Math.max(7, Number(params.horizonDays ?? 30)));
  const purchaseDate = params.date ?? isoDate();
  const purchaseItem: ForecastItem = {
    id: "planned-purchase",
    date: purchaseDate,
    label: params.description || "Planned purchase",
    amount: requestedAmount,
    direction: "expense",
  };

  const before = await getCashflowSnapshot(userId, horizonDays);
  const { forecast } = await getCashflowForecast(userId, horizonDays, [purchaseItem]);
  const safeBefore = Math.max(0, before.forecast.projectedLowBalance - before.minimumBuffer);
  const safeAfter = forecast.projectedLowBalance - before.minimumBuffer;
  const suggestedMaxPurchase = Math.max(0, safeBefore);

  const status: AffordabilityResult["status"] = safeAfter >= 100
    ? "yes"
    : safeAfter >= 0
      ? "caution"
      : "no";

  const blockingObligations = forecast.upcomingExpenses
    .filter((item) => item.id !== "planned-purchase")
    .slice(0, 5);
  const keyReasons = [
    `Safe-to-spend before this purchase is $${safeBefore.toFixed(2)}.`,
    `After the purchase, projected low balance is $${forecast.projectedLowBalance.toFixed(2)} against a $${before.minimumBuffer.toFixed(2)} buffer.`,
  ];
  if (blockingObligations.length) {
    keyReasons.push(`Upcoming obligations include ${blockingObligations.slice(0, 3).map((i) => `${i.label} on ${i.date}`).join(", ")}.`);
  }
  if (!before.nextIncomeDate) keyReasons.push("No recurring income was confidently detected in the forecast horizon.");

  return {
    status,
    requestedAmount,
    description: params.description,
    purchaseDate,
    safeToSpendBeforePurchase: +safeBefore.toFixed(2),
    safeToSpendAfterPurchase: +safeAfter.toFixed(2),
    currentSpendableBalance: before.forecast.currentSpendableBalance,
    projectedLowBalanceAfterPurchase: forecast.projectedLowBalance,
    minimumBuffer: before.minimumBuffer,
    horizonDays,
    keyReasons,
    blockingObligations,
    suggestedMaxPurchase: +suggestedMaxPurchase.toFixed(2),
    forecast,
  };
}
