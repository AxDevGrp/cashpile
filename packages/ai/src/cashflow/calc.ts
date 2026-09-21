import type { CashflowDirection, RecurringCadence, RecurringFlowKind, RecurringItem } from "./types";

export type CalcRole = "spending_source" | "reserve" | "credit_liability" | "investment" | "loan" | "ignore";

export interface CalcAccount {
  id: string;
  role: CalcRole;
  included: boolean;
  spendableCents: number | null;
  balanceAsOf: string | null;
  isEmergency: boolean;
}

export interface CalcRecurringItem {
  id: string;
  merchant: string;
  amountCents: number;
  direction: CashflowDirection;
  cadence: RecurringCadence;
  anchorDate: string;
  anchorDaysOfMonth?: number[];
  accountIds: string[];
  flowKind: RecurringFlowKind;
  cashEffect: boolean;
  landsOnSpendable: boolean;
  included: boolean;
  confirmed: boolean;
}

export interface PersistedRecurringItem {
  id: string;
  stableKey: string;
  direction: CashflowDirection;
  merchant: string;
  descriptionPattern: string;
  amountCents: number;
  cadence: RecurringCadence;
  nextDate: string | null;
  anchorDaysOfMonth?: number[] | null;
  accountIds: string[];
  included: boolean;
  confirmedAt: string | null;
  flowKind: RecurringFlowKind;
  counterpartyAccountIds: string[];
  isSubscription: boolean;
  reviewStatus: "keep" | "review" | "cancel_help" | null;
  lastSeenDate: string | null;
  source: "detected" | "manual";
}

const NON_SUBSCRIPTION_PATTERN = /\b(rent|mortgage|landlord|lease|insur|electr|utilit|water|sewer|garbage|trash|phone|cellular|carrier|internet|broadband|cable|bank|loan|payroll|tax|hoa|tuition|daycare|childcare|alimony)/;

/**
 * Deterministic subscription heuristic: regular small-to-medium service charges
 * whose description does not look like a household bill. Detection proposes;
 * only user confirmation (is_subscription persisted) is authoritative.
 */
export function looksLikeSubscription(candidate: {
  direction: CashflowDirection;
  descriptionPattern: string;
  cadence: RecurringCadence;
  amountCents: number;
  flowKind: RecurringFlowKind;
}): boolean {
  if (candidate.direction !== "expense") return false;
  if (candidate.flowKind !== "standard") return false;
  if (!["monthly", "quarterly", "annual"].includes(candidate.cadence)) return false;
  const monthly = monthlyEquivalentCents(candidate.amountCents, candidate.cadence);
  if (monthly < 100 || monthly > 50000) return false;
  return !NON_SUBSCRIPTION_PATTERN.test(candidate.descriptionPattern);
}

export interface CalcObservedTxn {
  date: string;
  amountCents: number;
  accountId: string;
  accountRole: CalcRole;
  accountIncluded: boolean;
  pending: boolean;
}

export interface CalcScenario {
  id: string;
  type: "purchase" | "savings_transfer";
  amountCents: number;
  date: string;
  label?: string;
  reserveAccountId?: string;
}

export interface CalcDataQuality {
  historyDays: number;
  historyComplete: boolean;
  accountsIncluded: number;
  accountsExcluded: number;
  pendingCount: number;
  pendingNetCents: number;
}

export interface CalcInput {
  today: string;
  horizonDays: number;
  bufferCents: number;
  accounts: CalcAccount[];
  recurring: CalcRecurringItem[];
  essentialWeeklyAllowanceCents: number | null;
  scenarios: CalcScenario[];
  paydayDate: string | null;
  paydayProvisional: boolean;
  observed: CalcObservedTxn[];
  dataQuality: CalcDataQuality;
}

export interface SimItem {
  id: string;
  date: string;
  label: string;
  amountCents: number;
  direction: CashflowDirection;
  accountId?: string;
  recurringItemId?: string;
  scenarioId?: string;
  kind: "recurring" | "allowance" | "scenario";
}

export interface SimDay {
  date: string;
  perAccountCents: Record<string, number>;
  totalCents: number;
  items: SimItem[];
}

export interface SimResult {
  openingCents: number;
  days: SimDay[];
  lowCents: number;
  lowDate: string;
  perAccountLow: Record<string, { cents: number; date: string }>;
  endCents: number;
  upcomingIncome: SimItem[];
  upcomingExpenses: SimItem[];
}

export interface MonthlyMarginCents {
  month: string;
  through: string;
  partialMonth: boolean;
  incomeCents: number;
  expenseCents: number;
  marginCents: number;
  savingsAllocationCents: number;
  cardPaymentCents: number;
  /** Prior month's margin measured through the same day-of-month; set only on the current month. */
  comparableMarginCents?: number;
}

export interface CalcSnapshot {
  sim: SimResult;
  paydayWindow: { nextPayday: string | null; end: string; provisional: boolean };
  availability: { availableCents: number; lowCents: number; lowDate: string } | null;
  risk: {
    lowCents: number;
    lowDate: string;
    bufferCents: number;
    shortfallCents: number;
    firstBelowBufferDate: string | null;
    firstNegativeDate: string | null;
    causes: SimItem[];
  };
  margins: MonthlyMarginCents[];
  cushion: {
    reserveCents: number;
    essentialMonthlyCents: number | null;
    months: number | null;
    estimated: boolean;
  };
  netWorth: CalcNetWorth;
}

const DAY_MS = 86_400_000;
const STALE_MS = 48 * 3_600_000;

export function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s;
}

export function clampHorizonDays(horizonDays: number): number {
  const n = Math.round(Number(horizonDays));
  if (!Number.isFinite(n)) return 30;
  return Math.min(90, Math.max(7, n));
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[0] ?? 1;
  let bestCount = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestCount || (n === bestCount && v < best)) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

function dayClusters(days: number[]): number[] {
  const sorted = [...days].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const day of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && day - last[last.length - 1] <= 1) last.push(day);
    else clusters.push([day]);
  }
  return clusters.map((c) => Math.round(median(c)));
}

export interface DetectedCadence {
  cadence: RecurringCadence;
  days: number;
  regularity: number;
  anchorDaysOfMonth?: number[];
}

export function detectCadence(dates: string[]): DetectedCadence | null {
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d = daysBetween(dates[i - 1], dates[i]);
    if (d > 0) intervals.push(d);
  }
  if (!intervals.length) return null;
  const med = median(intervals);
  const spread = Math.max(...intervals) - Math.min(...intervals);

  if (med >= 13 && med <= 17 && spread >= 2) {
    const clusters = dayClusters(dates.map((d) => parseDate(d).getUTCDate()));
    if (clusters.length === 2) {
      const regularity = intervals.filter((i) => i >= 13 && i <= 17).length / intervals.length;
      return { cadence: "twice_monthly", days: Math.round(med), regularity, anchorDaysOfMonth: clusters };
    }
  }

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
  if (best.diff > tolerance || regularity < 0.5) return null;
  const anchorDaysOfMonth = best.cadence === "monthly" ? [mode(dates.map((d) => parseDate(d).getUTCDate()))] : undefined;
  return { cadence: best.cadence, days: best.days, regularity, anchorDaysOfMonth };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(date: string, months: number, dayOfMonth: number): string {
  const d = parseDate(date);
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  const day = Math.min(dayOfMonth, daysInMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface CalcSchedule {
  cadence: RecurringCadence;
  anchorDate: string;
  anchorDaysOfMonth?: number[];
}

export function advanceOccurrence(date: string, schedule: CalcSchedule): string {
  switch (schedule.cadence) {
    case "weekly":
      return addDays(date, 7);
    case "biweekly":
      return addDays(date, 14);
    case "monthly":
      return addMonthsClamped(date, 1, schedule.anchorDaysOfMonth?.[0] ?? parseDate(date).getUTCDate());
    case "quarterly":
      return addMonthsClamped(date, 3, schedule.anchorDaysOfMonth?.[0] ?? parseDate(date).getUTCDate());
    case "annual":
      return addMonthsClamped(date, 12, schedule.anchorDaysOfMonth?.[0] ?? parseDate(date).getUTCDate());
    case "twice_monthly": {
      const days = schedule.anchorDaysOfMonth?.length ? schedule.anchorDaysOfMonth : [1, 15];
      const [d1, d2] = days[0] <= days[1] ? [days[0], days[1]] : [days[1], days[0]];
      const cur = parseDate(date);
      const year = cur.getUTCFullYear();
      const monthIndex = cur.getUTCMonth();
      const first = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(Math.min(d1, daysInMonth(year, monthIndex))).padStart(2, "0")}`;
      const second = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(Math.min(d2, daysInMonth(year, monthIndex))).padStart(2, "0")}`;
      if (date < first) return first;
      if (date < second) return second;
      return addMonthsClamped(first, 1, d1);
    }
    default:
      return addDays(date, 30);
  }
}

export function nextOccurrenceOnOrAfter(schedule: CalcSchedule, startDate: string): string {
  let date = schedule.anchorDate;
  let guard = 0;
  while (date < startDate && guard++ < 600) {
    date = advanceOccurrence(date, schedule);
  }
  return date;
}

export function expandOccurrences(schedule: CalcSchedule, start: string, end: string): string[] {
  const out: string[] = [];
  let date = nextOccurrenceOnOrAfter(schedule, start);
  let guard = 0;
  while (date <= end && guard++ < 60) {
    out.push(date);
    date = advanceOccurrence(date, schedule);
  }
  return out;
}

export function isBalanceStale(balanceAsOf: string | null, now = Date.now()): boolean {
  if (!balanceAsOf) return true;
  const t = new Date(balanceAsOf).getTime();
  if (Number.isNaN(t)) return true;
  return now - t > STALE_MS;
}

function primarySpendingId(accounts: CalcAccount[]): string | null {
  const spendable = accounts.filter((a) => a.included && a.role === "spending_source" && a.spendableCents != null);
  if (!spendable.length) return null;
  return spendable.reduce((best, a) => (a.spendableCents! > best.spendableCents! ? a : best), spendable[0]).id;
}

export function buildSimItems(input: CalcInput): SimItem[] {
  const primary = primarySpendingId(input.accounts);
  const horizonEnd = addDays(input.today, input.horizonDays);
  const items: SimItem[] = [];

  for (const item of input.recurring) {
    if (!item.included) continue;
    const affectsCash = item.direction === "expense" ? item.cashEffect : item.landsOnSpendable;
    if (!affectsCash) continue;
    const dates = expandOccurrences(item, input.today, horizonEnd);
    for (const date of dates) {
      items.push({
        id: `${item.id}-${date}`,
        date,
        label: item.merchant,
        amountCents: item.amountCents,
        direction: item.direction,
        accountId: item.accountIds.find((id) => id === primary) ?? item.accountIds[0],
        recurringItemId: item.id,
        kind: "recurring",
      });
    }
  }

  if (input.essentialWeeklyAllowanceCents && input.essentialWeeklyAllowanceCents > 0 && primary) {
    for (let i = 0; i <= input.horizonDays; i++) {
      const date = addDays(input.today, i);
      if (parseDate(date).getUTCDay() === 1) {
        items.push({
          id: `essential-allowance-${date}`,
          date,
          label: "Everyday spending",
          amountCents: input.essentialWeeklyAllowanceCents,
          direction: "expense",
          accountId: primary,
          kind: "allowance",
        });
      }
    }
  }

  for (const scenario of input.scenarios) {
    if (scenario.amountCents <= 0 || !isValidISODate(scenario.date)) continue;
    if (scenario.date < input.today || scenario.date > horizonEnd) continue;
    items.push({
      id: scenario.id,
      date: scenario.date,
      label: scenario.label ?? (scenario.type === "savings_transfer" ? "Transfer to savings" : "Planned purchase"),
      amountCents: scenario.amountCents,
      direction: "expense",
      accountId: primary ?? undefined,
      scenarioId: scenario.id,
      kind: "scenario",
    });
  }

  return items;
}

function itemSort(a: SimItem, b: SimItem): number {
  if (a.direction !== b.direction) return a.direction === "expense" ? -1 : 1;
  if (a.direction === "expense" && a.amountCents !== b.amountCents) return b.amountCents - a.amountCents;
  if (a.direction === "income" && a.amountCents !== b.amountCents) return a.amountCents - b.amountCents;
  return a.label.localeCompare(b.label);
}

export function simulate(input: CalcInput): SimResult {
  const simAccounts = input.accounts.filter((a) => a.included && a.role === "spending_source" && a.spendableCents != null);
  const per: Record<string, number> = {};
  for (const a of simAccounts) per[a.id] = a.spendableCents!;
  const primary = primarySpendingId(input.accounts);

  const allItems = buildSimItems(input).sort((a, b) => a.date.localeCompare(b.date) || itemSort(a, b));
  const openingCents = Object.values(per).reduce((s, v) => s + v, 0);

  const days: SimDay[] = [];
  let total = openingCents;
  let lowCents = openingCents;
  let lowDate = input.today;
  const perAccountLow: Record<string, { cents: number; date: string }> = {};
  for (const a of simAccounts) perAccountLow[a.id] = { cents: a.spendableCents!, date: input.today };

  for (let i = 0; i <= input.horizonDays; i++) {
    const date = addDays(input.today, i);
    const dayItems = allItems.filter((item) => item.date === date);
    for (const item of dayItems) {
      const accountId = item.accountId && item.accountId in per ? item.accountId : primary;
      if (item.direction === "expense") {
        total -= item.amountCents;
        if (accountId) per[accountId] -= item.amountCents;
      } else {
        total += item.amountCents;
        if (accountId) per[accountId] += item.amountCents;
      }
      if (total < lowCents) {
        lowCents = total;
        lowDate = date;
      }
      for (const a of simAccounts) {
        if (per[a.id] < perAccountLow[a.id].cents) perAccountLow[a.id] = { cents: per[a.id], date };
      }
    }
    days.push({ date, perAccountCents: { ...per }, totalCents: total, items: dayItems });
  }

  return {
    openingCents,
    days,
    lowCents,
    lowDate,
    perAccountLow,
    endCents: total,
    upcomingIncome: allItems.filter((i) => i.direction === "income"),
    upcomingExpenses: allItems.filter((i) => i.direction === "expense"),
  };
}

export function availabilityInWindow(
  sim: SimResult,
  endDate: string,
  bufferCents: number,
): { availableCents: number; lowCents: number; lowDate: string } {
  const windowDays = sim.days.filter((d) => d.date <= endDate);
  let low = sim.openingCents;
  let lowDate = sim.days[0]?.date ?? "";
  for (const d of windowDays) {
    if (d.totalCents < low) {
      low = d.totalCents;
      lowDate = d.date;
    }
  }
  return { availableCents: low - bufferCents, lowCents: low, lowDate };
}

export function cashRisk(sim: SimResult, bufferCents: number): CalcSnapshot["risk"] {
  let firstBelowBufferDate: string | null = null;
  let firstNegativeDate: string | null = null;
  for (const d of sim.days) {
    if (firstBelowBufferDate === null && d.totalCents < bufferCents) firstBelowBufferDate = d.date;
    if (firstNegativeDate === null && d.totalCents < 0) firstNegativeDate = d.date;
  }
  const causes = sim.days.find((d) => d.date === sim.lowDate)?.items ?? [];
  return {
    lowCents: sim.lowCents,
    lowDate: sim.lowDate,
    bufferCents,
    shortfallCents: Math.max(0, -sim.lowCents),
    firstBelowBufferDate,
    firstNegativeDate,
    causes,
  };
}

interface PairCandidate {
  date: string;
  accountId: string;
  role: CalcRole;
  used: boolean;
}

function pairFlows(observed: CalcObservedTxn[]) {
  const creditsOnNonSpending = new Map<number, PairCandidate[]>();
  const debitsOnNonSpending = new Map<number, PairCandidate[]>();
  for (const txn of observed) {
    if (!txn.accountIncluded) continue;
    if (txn.accountRole === "spending_source" || txn.accountRole === "ignore") continue;
    const map = txn.amountCents > 0 ? creditsOnNonSpending : debitsOnNonSpending;
    const key = Math.abs(txn.amountCents);
    const arr = map.get(key) ?? [];
    arr.push({ date: txn.date, accountId: txn.accountId, role: txn.accountRole, used: false });
    map.set(key, arr);
  }

  const findPair = (map: Map<number, PairCandidate[]>, amountCents: number, date: string): PairCandidate | null => {
    const candidates = map.get(Math.abs(amountCents));
    if (!candidates) return null;
    const match = candidates
      .filter((c) => !c.used && Math.abs(daysBetween(c.date, date)) <= 3)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (match) match.used = true;
    return match;
  };

  return { findCreditPair: (t: CalcObservedTxn) => findPair(creditsOnNonSpending, t.amountCents, t.date),
           findDebitPair: (t: CalcObservedTxn) => findPair(debitsOnNonSpending, t.amountCents, t.date) };
}

type ClassifiedFlow = { month: string; day: number; kind: "income" | "expense" | "savings" | "card"; amountCents: number };

function classifyFlows(observed: CalcObservedTxn[]): ClassifiedFlow[] {
  const { findCreditPair, findDebitPair } = pairFlows(observed);
  const flows: ClassifiedFlow[] = [];
  for (const txn of observed) {
    if (!txn.accountIncluded) continue;
    const amount = Math.abs(txn.amountCents);
    const month = txn.date.slice(0, 7);
    const day = Number(txn.date.slice(8, 10));
    if (txn.accountRole === "spending_source") {
      if (txn.amountCents < 0) {
        const pair = findCreditPair(txn);
        if (pair) flows.push({ month, day, kind: pair.role === "credit_liability" || pair.role === "loan" ? "card" : "savings", amountCents: amount });
        else flows.push({ month, day, kind: "expense", amountCents: amount });
      } else {
        const pair = findDebitPair(txn);
        if (!pair) flows.push({ month, day, kind: "income", amountCents: amount });
      }
    } else if (txn.accountRole === "credit_liability" || txn.accountRole === "loan") {
      if (txn.amountCents < 0) flows.push({ month, day, kind: "expense", amountCents: amount });
    }
  }
  return flows;
}

function aggregate(flows: ClassifiedFlow[]): Pick<MonthlyMarginCents, "incomeCents" | "expenseCents" | "savingsAllocationCents" | "cardPaymentCents" | "marginCents"> {
  const totals = { incomeCents: 0, expenseCents: 0, savingsAllocationCents: 0, cardPaymentCents: 0, marginCents: 0 };
  for (const flow of flows) {
    if (flow.kind === "income") totals.incomeCents += flow.amountCents;
    else if (flow.kind === "expense") totals.expenseCents += flow.amountCents;
    else if (flow.kind === "savings") totals.savingsAllocationCents += flow.amountCents;
    else totals.cardPaymentCents += flow.amountCents;
  }
  totals.marginCents = totals.incomeCents - totals.expenseCents;
  return totals;
}

export function computeMonthlyMargins(observed: CalcObservedTxn[], today: string, months = 6): MonthlyMarginCents[] {
  const flows = classifyFlows(observed);
  const currentMonth = today.slice(0, 7);
  const currentDay = Number(today.slice(8, 10));

  const monthKeys: string[] = [];
  let cursor = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < months; i++) {
    monthKeys.unshift(cursor.slice(0, 7));
    cursor = addMonthsClamped(cursor, -1, 1);
  }

  const result: MonthlyMarginCents[] = monthKeys.map((month) => ({
    month,
    through: month === currentMonth ? today : `${month}-${String(daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1)).padStart(2, "0")}`,
    partialMonth: month === currentMonth,
    ...aggregate(flows.filter((f) => f.month === month)),
  }));

  const current = result.find((m) => m.month === currentMonth);
  const priorMonthKey = result.length >= 2 ? result[result.length - 2].month : undefined;
  if (current && priorMonthKey) {
    current.comparableMarginCents = aggregate(
      flows.filter((f) => f.month === priorMonthKey && f.day <= currentDay),
    ).marginCents;
  }
  return result;
}

export interface CalcNetWorth {
  assetCents: number;
  liabilityCents: number;
  netCents: number;
  accountsIncluded: number;
  accountsMissingBalance: number;
}

export function computeNetWorth(accounts: CalcAccount[]): CalcNetWorth {
  let assetCents = 0;
  let liabilityCents = 0;
  let accountsIncluded = 0;
  let accountsMissingBalance = 0;
  for (const account of accounts) {
    if (!account.included) continue;
    if (account.spendableCents == null) {
      accountsMissingBalance++;
      continue;
    }
    accountsIncluded++;
    if (account.role === "credit_liability" || account.role === "loan") liabilityCents += Math.abs(account.spendableCents);
    else if (account.role !== "ignore") assetCents += account.spendableCents;
  }
  return { assetCents, liabilityCents, netCents: assetCents - liabilityCents, accountsIncluded, accountsMissingBalance };
}

export function computeCushion(
  reserveCents: number,
  essentialMonthlyCents: number | null,
): CalcSnapshot["cushion"] {
  const months = essentialMonthlyCents && essentialMonthlyCents > 0 ? reserveCents / essentialMonthlyCents : null;
  return {
    reserveCents,
    essentialMonthlyCents,
    months,
    estimated: true,
  };
}

export function monthlyEquivalentCents(amountCents: number, cadence: RecurringCadence): number {
  switch (cadence) {
    case "weekly": return Math.round((amountCents * 52) / 12);
    case "biweekly": return Math.round((amountCents * 26) / 12);
    case "twice_monthly": return amountCents * 2;
    case "monthly": return amountCents;
    case "quarterly": return Math.round(amountCents / 3);
    case "annual": return Math.round(amountCents / 12);
    default: return 0;
  }
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function mergeRecurringItems(proposals: RecurringItem[], persisted: PersistedRecurringItem[], today: string, fallbackAccountId: string | null): RecurringItem[] {
  const persistedKeys = new Set(persisted.map((p) => p.stableKey));
  const merged: RecurringItem[] = [];

  for (const proposal of proposals) {
    if (proposal.stableKey && persistedKeys.has(proposal.stableKey)) continue;
    merged.push(proposal);
  }

  for (const row of persisted) {
    const accountIds = row.accountIds.length ? row.accountIds : fallbackAccountId ? [fallbackAccountId] : [];
    const anchor = row.nextDate ?? row.lastSeenDate ?? today;
    const nextExpectedDate = nextOccurrenceOnOrAfter(
      { cadence: row.cadence, anchorDate: anchor, anchorDaysOfMonth: row.anchorDaysOfMonth ?? undefined },
      today,
    );
    merged.push({
      id: row.id,
      merchant: row.merchant,
      descriptionPattern: row.descriptionPattern,
      averageAmount: centsToDollars(row.amountCents),
      direction: row.direction,
      cadence: row.cadence,
      nextExpectedDate,
      confidence: 1,
      accountIds,
      transactionIds: [],
      lastSeenDate: row.lastSeenDate ?? anchor,
      anchorDaysOfMonth: row.anchorDaysOfMonth ?? undefined,
      flowKind: row.flowKind,
      counterpartyAccountIds: row.counterpartyAccountIds,
      stableKey: row.stableKey,
      confirmed: !!row.confirmedAt,
      included: row.included,
      source: row.source,
      isSubscription: row.isSubscription,
      reviewStatus: row.reviewStatus,
    });
  }

  return merged.sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate));
}

export interface PaydayCandidate {
  nextDate: string;
  cadence: RecurringCadence;
  confirmed: boolean;
  landsOnSpendable: boolean;
  direction: CashflowDirection;
}

/**
 * Confirmed income wins over an earlier unconfirmed proposal: the payday window
 * anchors to the payday the user actually confirmed. Without any confirmed
 * payday, the earliest detected payroll-cadence income is used, provisional.
 */
export function selectPayday(candidates: PaydayCandidate[], today: string): { paydayDate: string | null; provisional: boolean } {
  const eligible = candidates.filter(
    (c) => c.direction === "income" && c.landsOnSpendable && ["weekly", "biweekly", "twice_monthly", "monthly"].includes(c.cadence),
  );
  const future = eligible.filter((c) => c.nextDate > today);
  const confirmed = future.filter((c) => c.confirmed);
  const pool = confirmed.length ? confirmed : future;
  const earliest = pool.map((c) => c.nextDate).sort()[0] ?? null;
  return { paydayDate: earliest, provisional: !confirmed.some((c) => c.nextDate === earliest) };
}

export function essentialMonthlyOutflowCents(input: Pick<CalcInput, "recurring" | "essentialWeeklyAllowanceCents">): number | null {
  let total = 0;
  let known = false;
  for (const item of input.recurring) {
    if (item.direction !== "expense" || item.flowKind !== "standard" || !item.cashEffect || !item.included) continue;
    total += monthlyEquivalentCents(item.amountCents, item.cadence);
    known = true;
  }
  if (input.essentialWeeklyAllowanceCents && input.essentialWeeklyAllowanceCents > 0) {
    total += monthlyEquivalentCents(input.essentialWeeklyAllowanceCents, "weekly");
    known = true;
  }
  return known ? total : null;
}

export function computeCashflow(input: CalcInput): CalcSnapshot {
  const sim = simulate(input);
  const payday = input.paydayDate && input.paydayDate > input.today ? input.paydayDate : null;
  const end = payday ? addDays(payday, -1) : addDays(input.today, 13);
  const hasSpendableAccounts = input.accounts.some((a) => a.included && a.role === "spending_source" && a.spendableCents != null);
  const availability = hasSpendableAccounts ? availabilityInWindow(sim, end, input.bufferCents) : null;
  const reserveCents = input.accounts
    .filter((a) => a.included && a.role === "reserve" && a.isEmergency && a.spendableCents != null)
    .reduce((s, a) => s + a.spendableCents!, 0);
  const cushion = computeCushion(reserveCents, essentialMonthlyOutflowCents(input));
  return {
    sim,
    paydayWindow: { nextPayday: payday, end, provisional: input.paydayProvisional },
    availability,
    risk: cashRisk(sim, input.bufferCents),
    margins: computeMonthlyMargins(input.observed, input.today),
    cushion,
    netWorth: computeNetWorth(input.accounts),
  };
}
