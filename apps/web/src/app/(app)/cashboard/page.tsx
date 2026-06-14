import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Coins,
  CreditCard,
  Gauge,
  Landmark,
  PiggyBank,
  Search,
  ShieldAlert,
  Sparkles,
  Umbrella,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { formatCurrency } from "@cashpile/ui";
import { generateCashboardBriefing, getCashflowSnapshot } from "@cashpile/ai";
import { CashInputStrip } from "./_components/cash-input-strip";
import { GremmyReminderModal, type GremmyReminder } from "./_components/gremmy-reminder-modal";
import { AffordabilityForm } from "@/components/cashflow/affordability-form";

// ─── Data helpers ────────────────────────────────────────────────────────────

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number | string;
  transaction_type: "debit" | "credit" | string | null;
  category_id: number | null;
  is_transfer?: boolean | null;
};

type CategoryRow = {
  id: number;
  name: string;
  category_type: string | null;
};

type SubscriptionSummaryItem = {
  name: string;
  monthlyCost: number;
  ytdSpend: number;
  cadence: string;
  nextDate: string;
};

type SubscriptionSummary = {
  items: SubscriptionSummaryItem[];
  monthlyTotal: number;
  ytdTotal: number;
};

type IncomeMix = {
  wageIncome: number;
  ownerIncome: number;
  unknownIncome: number;
  ownerPct: number;
  label: string;
};

type MoneyLeaks = {
  alertCount: number;
  biggestSpikeLabel: string;
  biggestSpikePct: number;
  duplicateCount: number;
  increasedSubscriptionCount: number;
};

type GremmyReminderInput = {
  uncategorizedCount: number;
  creditCardsNearPayoff: Array<{ name: string; balance: number }>;
};

type AiBudget = {
  monthlyAverage: number;
  suggestedTarget: number;
  topCategoryLabel: string;
  confidence: "High" | "Medium" | "Low";
  needsLabels: boolean;
};

type SpendingTrendPoint = {
  label: string;
  amount: number;
  height: number;
};

const cashpileDashboardStyles = `
  .cp-dashboard {
    min-height: 100%;
    background:
      radial-gradient(circle at 8% 0%, rgba(24, 201, 154, 0.16), transparent 30%),
      radial-gradient(circle at 92% 0%, rgba(37, 99, 235, 0.12), transparent 28%),
      #f7f5ef;
    color: #101828;
  }
  .cp-dashboard-shell {
    width: 100%;
    max-width: 80rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 5.5rem;
  }
  .cp-dashboard-stack { display: grid; gap: 1.5rem; }
  .cp-page-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .cp-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    border: 1px solid #a7f3d0;
    background: rgba(255, 255, 255, 0.82);
    color: #047857;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 800;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }
  .cp-title {
    margin-top: 0.75rem;
    font-size: clamp(2rem, 4vw, 3.75rem);
    line-height: 0.95;
    letter-spacing: -0.06em;
    font-weight: 950;
    color: #020617;
  }
  .cp-subtitle {
    margin-top: 0.6rem;
    max-width: 44rem;
    color: #475569;
    font-size: 0.95rem;
    line-height: 1.55;
  }
  .cp-nav-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 800;
    color: #475569;
  }
  .cp-nav-chip {
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.82);
    border-radius: 999px;
    padding: 0.45rem 0.8rem;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }
  .cp-panel {
    overflow: hidden;
    border: 1px solid #fff;
    background: #fff;
    border-radius: 2rem;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
  }
  .cp-hero-grid { display: grid; }
  .cp-hero-main {
    position: relative;
    padding: 1.5rem;
    background:
      radial-gradient(circle at 18% 20%, rgba(24, 201, 154, 0.14), transparent 24%),
      linear-gradient(135deg, rgba(255,255,255,0), rgba(37,99,235,0.04));
  }
  .cp-hero-content {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .cp-gremlin-image {
    width: min(19rem, 42vw);
    max-width: 100%;
    height: auto;
    flex: 0 0 auto;
    object-fit: contain;
    filter: drop-shadow(0 18px 24px rgba(15, 23, 42, 0.14));
  }
  .cp-briefing-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid #a7f3d0;
    background: #ecfdf5;
    color: #047857;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cp-hero-title {
    margin-top: 0.75rem;
    font-size: clamp(1.6rem, 3.5vw, 2.6rem);
    line-height: 1.05;
    letter-spacing: -0.055em;
    font-weight: 950;
    color: #020617;
  }
  .cp-copy {
    margin-top: 0.85rem;
    color: #475569;
    font-size: 0.92rem;
    line-height: 1.65;
  }
  .cp-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  .cp-button-primary,
  .cp-button-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 999px;
    padding: 0.6rem 1rem;
    font-size: 0.875rem;
    font-weight: 900;
    text-decoration: none;
  }
  .cp-button-primary {
    background: #18c99a;
    color: #020617;
    box-shadow: 0 10px 24px rgba(24, 201, 154, 0.24);
  }
  .cp-button-secondary {
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #334155;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }
  .cp-side-panel {
    border-top: 1px solid #f1f5f9;
    background: #fff;
    padding: 1.25rem;
  }
  .cp-inner-card,
  .cp-card {
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 1.5rem;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07);
  }
  .cp-inner-card { padding: 1rem; }
  .cp-card { padding: 1.25rem; }
  .cp-metric-grid,
  .cp-content-grid,
  .cp-lower-grid,
  .cp-question-grid {
    display: grid;
    gap: 1rem;
  }
  .cp-card-title {
    color: #020617;
    font-size: 1.125rem;
    font-weight: 950;
    letter-spacing: -0.03em;
  }
  .cp-card-muted { color: #64748b; font-size: 0.875rem; }
  .cp-metric-label {
    margin-top: 1.25rem;
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cp-metric-value {
    margin-top: 0.25rem;
    color: #020617;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 1.85rem;
    line-height: 1.05;
    font-weight: 950;
    font-variant-numeric: tabular-nums;
  }
  .cp-pill {
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    padding: 0.25rem 0.65rem;
    font-size: 0.68rem;
    font-weight: 900;
  }
  .cp-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    height: 14rem;
    border: 1px solid #f1f5f9;
    background: #fbfaf7;
    border-radius: 1.5rem;
    padding: 1rem;
  }
  .cp-bar {
    border-radius: 1rem 1rem 0 0;
    background: linear-gradient(to top, #2563eb, #18c99a);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  }
  .cp-move {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid #f1f5f9;
    background: rgba(248, 250, 252, 0.72);
    border-radius: 1rem;
    padding: 0.75rem;
    text-decoration: none;
  }
  .cp-move-icon {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    border-radius: 1rem;
    background: #f8fafc;
    color: #0f172a;
  }
  .cp-progress-track {
    height: 0.75rem;
    overflow: hidden;
    border-radius: 999px;
    background: #f1f5f9;
  }
  .cp-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(to right, #18c99a, #2563eb);
  }
  .cp-question-card {
    display: flex;
    min-height: 235px;
    flex-direction: column;
    border: 1px solid #fff;
    background: #fff;
    border-radius: 1.5rem;
    padding: 1.25rem;
    text-decoration: none;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
  }
  @media (min-width: 640px) {
    .cp-dashboard-shell { padding-left: 1.5rem; padding-right: 1.5rem; }
    .cp-hero-content { flex-direction: row; align-items: center; }
    .cp-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cp-question-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (min-width: 1024px) {
    .cp-dashboard-shell { padding-left: 2rem; padding-right: 2rem; }
    .cp-page-header { flex-direction: row; align-items: flex-end; justify-content: space-between; }
    .cp-hero-grid { grid-template-columns: minmax(0, 1fr) 22.5rem; gap: 1.25rem; }
    .cp-side-panel { border-left: 1px solid #f1f5f9; border-top: 0; }
  }
  @media (min-width: 1280px) {
    .cp-metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .cp-content-grid { grid-template-columns: 1.4fr 0.9fr; }
    .cp-lower-grid { grid-template-columns: 0.95fr 1.05fr; }
    .cp-question-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
`;

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizeSubscriptionName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(pos|debit|card|purchase|payment|online|ach|web|id|co|inc|llc)\b/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function monthlySubscriptionCost(amount: number, cadence: string) {
  if (cadence === "weekly") return amount * 52 / 12;
  if (cadence === "biweekly") return amount * 26 / 12;
  if (cadence === "quarterly") return amount / 3;
  if (cadence === "annual") return amount / 12;
  return amount;
}

function looksLikeSubscription(item: { merchant: string; descriptionPattern: string; averageAmount: number; cadence: string }) {
  const text = `${item.merchant} ${item.descriptionPattern}`.toLowerCase();
  const include = /netflix|hulu|disney|spotify|apple|icloud|youtube|google|amazon kindle|prime|openai|anthropic|claude|openrouter|github|vercel|adobe|microsoft|notion|dropbox|zoom|espn|subscription|membership|patreon|substack|x premium|twitter|linkedin|chatgpt|supabase|genspark/.test(text);
  const exclude = /mortgage|loan|rent|insurance|utility|electric|water|gas bill|transfer|payroll|salary|home loans|auto loan|credit card|bank|discover|comcast|socalgas|gas company|wireless bill/.test(text);
  return item.cadence !== "irregular" && item.averageAmount > 0 && item.averageAmount <= 500 && include && !exclude;
}

async function getSubscriptionSummary(userId: string, recurringItems: Array<any>): Promise<SubscriptionSummary> {
  const subscriptionItems = recurringItems
    .filter((item) => item.direction === "expense" && looksLikeSubscription(item))
    .slice(0, 20);

  if (subscriptionItems.length === 0) return { items: [], monthlyTotal: 0, ytdTotal: 0 };

  const supabase = (await createServerSupabaseClient()) as any;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { data } = await supabase
    .from("books_transactions")
    .select("description, merchant, amount, transaction_type, date")
    .eq("user_id", userId)
    .eq("is_transfer", false)
    .eq("transaction_type", "debit")
    .gte("date", yearStart);

  const ytdRows = (data ?? []) as Array<{ description: string; merchant: string | null; amount: number }>;

  const items = subscriptionItems.map((item) => {
    const normalized = normalizeSubscriptionName(item.merchant) || normalizeSubscriptionName(item.descriptionPattern);
    const ytdSpend = ytdRows
      .filter((row) => {
        const rowName = normalizeSubscriptionName(row.merchant) || normalizeSubscriptionName(row.description);
        return normalized.length >= 4 && rowName.includes(normalized);
      })
      .reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);

    return {
      name: item.merchant,
      monthlyCost: +monthlySubscriptionCost(item.averageAmount, item.cadence).toFixed(2),
      ytdSpend: +ytdSpend.toFixed(2),
      cadence: item.cadence,
      nextDate: item.nextExpectedDate,
    };
  }).sort((a, b) => b.monthlyCost - a.monthlyCost);

  return {
    items,
    monthlyTotal: +items.reduce((sum, item) => sum + item.monthlyCost, 0).toFixed(2),
    ytdTotal: +items.reduce((sum, item) => sum + item.ytdSpend, 0).toFixed(2),
  };
}

async function getGremmyReminderInput(userId: string): Promise<GremmyReminderInput> {
  const supabase = (await createServerSupabaseClient()) as any;
  const [uncategorizedRes, cardsRes] = await Promise.all([
    supabase
      .from("books_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_transfer", false)
      .is("category_id", null),
    supabase
      .from("books_financial_accounts")
      .select("name, current_balance")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("account_type", "credit_card"),
  ]);

  const creditCardsNearPayoff = ((cardsRes.data ?? []) as Array<{ name: string; current_balance: number | string | null }>)
    .map((account) => ({ name: account.name, balance: Math.abs(Number(account.current_balance ?? 0)) }))
    .filter((account) => account.balance > 0 && account.balance <= 500)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 3);

  return {
    uncategorizedCount: uncategorizedRes.count ?? 0,
    creditCardsNearPayoff,
  };
}

async function getRecentBooksData(userId: string) {
  const supabase = (await createServerSupabaseClient()) as any;
  const [transactionsRes, categoriesRes] = await Promise.all([
    supabase
      .from("books_transactions")
      .select("id, date, description, merchant, amount, transaction_type, category_id, is_transfer")
      .eq("user_id", userId)
      .eq("is_transfer", false)
      .gte("date", daysAgo(120))
      .order("date", { ascending: false })
      .limit(3000),
    supabase
      .from("books_categories")
      .select("id, name, category_type")
      .eq("user_id", userId),
  ]);

  const categories = new Map<number, CategoryRow>();
  ((categoriesRes.data ?? []) as CategoryRow[]).forEach((category) => categories.set(category.id, category));
  return {
    transactions: (transactionsRes.data ?? []) as TransactionRow[],
    categories,
  };
}

function getCategoryName(row: TransactionRow, categories: Map<number, CategoryRow>) {
  return row.category_id ? categories.get(row.category_id)?.name ?? "Uncategorized" : "Uncategorized";
}

function classifyIncome(row: TransactionRow, categories: Map<number, CategoryRow>) {
  const text = `${row.description ?? ""} ${row.merchant ?? ""} ${getCategoryName(row, categories)}`.toLowerCase();
  if (/payroll|salary|wage|direct dep|direct deposit|paycheck|employer|adp|gusto|workday|paychex/.test(text)) return "wage";
  if (/rental|rent income|dividend|interest|royalty|business|consulting|contract|stripe|square|shopify|airbnb|vrbo|distribution|k-1|1099/.test(text)) return "owner";
  return "unknown";
}

function buildIncomeMix(transactions: TransactionRow[], categories: Map<number, CategoryRow>): IncomeMix {
  const incomeRows = transactions.filter((row) => row.transaction_type === "credit");
  let wageIncome = 0;
  let ownerIncome = 0;
  let unknownIncome = 0;

  incomeRows.forEach((row) => {
    const amount = Math.abs(Number(row.amount ?? 0));
    const type = classifyIncome(row, categories);
    if (type === "wage") wageIncome += amount;
    else if (type === "owner") ownerIncome += amount;
    else unknownIncome += amount;
  });

  const total = wageIncome + ownerIncome + unknownIncome;
  const ownerPct = total > 0 ? Math.round((ownerIncome / total) * 100) : 0;
  const label = total === 0
    ? "Needs income data"
    : ownerPct >= 35
      ? "Owner-style"
      : ownerPct >= 10
        ? "Mixed income"
        : "Worker-heavy";

  return { wageIncome, ownerIncome, unknownIncome, ownerPct, label };
}

function buildMoneyLeaks(transactions: TransactionRow[], categories: Map<number, CategoryRow>, subscriptions: SubscriptionSummary): MoneyLeaks {
  const debitRows = transactions.filter((row) => row.transaction_type === "debit");
  const last30Start = new Date(daysAgo(30));
  const previous30Start = new Date(daysAgo(60));
  const last30 = new Map<string, number>();
  const previous30 = new Map<string, number>();

  debitRows.forEach((row) => {
    const date = new Date(row.date);
    const category = getCategoryName(row, categories);
    const amount = Math.abs(Number(row.amount ?? 0));
    if (date >= last30Start) last30.set(category, (last30.get(category) ?? 0) + amount);
    else if (date >= previous30Start) previous30.set(category, (previous30.get(category) ?? 0) + amount);
  });

  let biggestSpikeLabel = "No unusual category spike yet";
  let biggestSpikePct = 0;
  last30.forEach((amount, category) => {
    const prior = previous30.get(category) ?? 0;
    if (prior >= 50 && amount > prior * 1.25) {
      const pct = Math.round(((amount - prior) / prior) * 100);
      if (pct > biggestSpikePct) {
        biggestSpikePct = pct;
        biggestSpikeLabel = category;
      }
    }
  });

  const duplicateKeys = new Set<string>();
  const seen = new Map<string, string>();
  debitRows
    .filter((row) => new Date(row.date) >= previous30Start)
    .forEach((row) => {
      const merchant = normalizeSubscriptionName(row.merchant) || normalizeSubscriptionName(row.description);
      const amount = Math.abs(Number(row.amount ?? 0)).toFixed(2);
      const key = `${merchant}:${amount}:${row.date}`;
      if (merchant.length >= 4 && seen.has(key)) duplicateKeys.add(key);
      seen.set(key, row.id);
    });

  const monthsElapsed = new Date().getMonth() + 1;
  const increasedSubscriptionCount = subscriptions.items.filter((item) => item.monthlyCost >= 25 && item.ytdSpend > item.monthlyCost * monthsElapsed * 1.25).length;
  const alertCount = (biggestSpikePct > 0 ? 1 : 0) + Math.min(duplicateKeys.size, 5) + increasedSubscriptionCount;

  return {
    alertCount,
    biggestSpikeLabel,
    biggestSpikePct,
    duplicateCount: duplicateKeys.size,
    increasedSubscriptionCount,
  };
}

function buildAiBudget(transactions: TransactionRow[], categories: Map<number, CategoryRow>): AiBudget {
  const debitRows = transactions.filter((row) => row.transaction_type === "debit" && new Date(row.date) >= new Date(daysAgo(90)));
  const total = debitRows.reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
  const monthlyAverage = total / 3;
  const categoryTotals = new Map<string, number>();
  debitRows.forEach((row) => {
    const category = getCategoryName(row, categories);
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + Math.abs(Number(row.amount ?? 0)));
  });
  const top = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const uncategorized = categoryTotals.get("Uncategorized") ?? 0;
  const needsLabels = total > 0 && uncategorized / total > 0.4;
  const confidence = needsLabels ? "Low" : debitRows.length >= 150 ? "High" : debitRows.length >= 45 ? "Medium" : "Low";

  return {
    monthlyAverage: +monthlyAverage.toFixed(2),
    suggestedTarget: +Math.max(0, monthlyAverage * 0.92).toFixed(2),
    topCategoryLabel: top?.[0] ?? "Not enough spending history",
    confidence,
    needsLabels,
  };
}

function buildGremmyReminders({
  cashflow,
  subscriptions,
  moneyLeaks,
  aiBudget,
  reminderInput,
}: {
  cashflow: Awaited<ReturnType<typeof getCashflowSnapshot>> | null;
  subscriptions: SubscriptionSummary;
  moneyLeaks: MoneyLeaks;
  aiBudget: AiBudget;
  reminderInput: GremmyReminderInput;
}): GremmyReminder[] {
  const reminders: GremmyReminder[] = [];

  if (reminderInput.uncategorizedCount > 0) {
    reminders.push({
      id: "categorize-transactions",
      title: `Categorize ${reminderInput.uncategorizedCount.toLocaleString()} transaction${reminderInput.uncategorizedCount === 1 ? "" : "s"}`,
      body: "Your books are cleaner, tax reports are sharper, and budget guesses get less sketchy once these are labeled.",
      cta: "Clean up transactions",
      href: "/books/transactions?filter=uncategorized",
      priority: reminderInput.uncategorizedCount >= 25 ? "high" : "medium",
    });
  }

  if (subscriptions.monthlyTotal >= 50 && subscriptions.items.length > 0) {
    const biggest = subscriptions.items[0];
    reminders.push({
      id: "review-recurring",
      title: `Review ${formatCurrency(subscriptions.monthlyTotal)}/mo in recurring charges`,
      body: `${biggest.name} is the biggest likely subscription at about ${formatCurrency(biggest.monthlyCost)}/mo. Cut one stale charge and future-you gets paid every month.`,
      cta: "Review recurring charges",
      href: "/cashflow/recurring",
      priority: subscriptions.monthlyTotal >= 150 ? "high" : "medium",
    });
  }

  for (const card of reminderInput.creditCardsNearPayoff) {
    reminders.push({
      id: `credit-card-${card.name}`,
      title: `${card.name} is close to paid off`,
      body: `About ${formatCurrency(card.balance)} remains. If cash flow allows, knocking this out could remove a monthly drag and simplify your money map.`,
      cta: "Check cash flow first",
      href: "/cashflow",
      priority: "medium",
    });
  }

  if (cashflow && cashflow.safeToSpend <= 0) {
    reminders.push({
      id: "cashflow-tight",
      title: "Cash looks tight before upcoming bills",
      body: `Projected low balance is ${formatCurrency(cashflow.forecast.projectedLowBalance)}. Gremmy says pause extra spending until the next income clears.`,
      cta: "Inspect cash flow",
      href: "/cashflow",
      priority: "high",
    });
  }

  if (moneyLeaks.alertCount > 0) {
    reminders.push({
      id: "money-leaks",
      title: `${moneyLeaks.alertCount} money leak signal${moneyLeaks.alertCount === 1 ? "" : "s"} to review`,
      body: moneyLeaks.biggestSpikePct > 0
        ? `${moneyLeaks.biggestSpikeLabel} is up ${moneyLeaks.biggestSpikePct}% versus the prior 30 days.`
        : "Possible duplicate charges or increased subscription patterns showed up in recent transactions.",
      cta: "Find the leak",
      href: "/books/transactions",
      priority: "medium",
    });
  }

  if (aiBudget.needsLabels && !reminderInput.uncategorizedCount) {
    reminders.push({
      id: "budget-needs-labels",
      title: "Budget confidence needs better labels",
      body: "Gremmy can draft a better spending target after more transaction categories are cleaned up.",
      cta: "Review transactions",
      href: "/books/transactions",
      priority: "low",
    });
  }

  const priorityWeight = { high: 0, medium: 1, low: 2 };
  return reminders
    .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority])
    .slice(0, 4);
}

function buildSpendingTrend(transactions: TransactionRow[]): SpendingTrendPoint[] {
  const points = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index), 1);
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-US", { month: "short" }),
      amount: 0,
    };
  });

  const pointByKey = new Map(points.map((point) => [point.key, point]));
  transactions
    .filter((row) => row.transaction_type === "debit")
    .forEach((row) => {
      const key = row.date.slice(0, 7);
      const point = pointByKey.get(key);
      if (point) point.amount += Math.abs(Number(row.amount ?? 0));
    });

  const maxAmount = Math.max(...points.map((point) => point.amount), 1);
  return points.map((point) => ({
    label: point.label,
    amount: +point.amount.toFixed(2),
    height: Math.max(12, Math.round((point.amount / maxAmount) * 100)),
  }));
}

function MoneyGremlin() {
  return (
    <img
      src="/assets/gremlin-v3-crop.png"
      alt=""
      className="cp-gremlin-image"
      aria-hidden="true"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ gremmy?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [cashflow, briefing, booksData, reminderInput] = await Promise.all([
    getCashflowSnapshot(user.id, 14).catch(() => null),
    generateCashboardBriefing(user.id).catch(() => "Set up your Books data to get your personalized AI briefing."),
    getRecentBooksData(user.id).catch(() => ({ transactions: [], categories: new Map<number, CategoryRow>() })),
    getGremmyReminderInput(user.id).catch(() => ({ uncategorizedCount: 0, creditCardsNearPayoff: [] })),
  ]);

  const subscriptionSummary = await getSubscriptionSummary(user.id, cashflow?.recurringItems ?? []);
  const incomeMix = buildIncomeMix(booksData.transactions, booksData.categories);
  const moneyLeaks = buildMoneyLeaks(booksData.transactions, booksData.categories, subscriptionSummary);
  const aiBudget = buildAiBudget(booksData.transactions, booksData.categories);
  const gremmyReminders = buildGremmyReminders({ cashflow, subscriptions: subscriptionSummary, moneyLeaks, aiBudget, reminderInput });
  const resolvedSearchParams = await searchParams;

  const affordabilityStatus = !cashflow
    ? "Needs data"
    : cashflow.safeToSpend > 500
      ? "Green light"
      : cashflow.safeToSpend > 0
        ? "Caution"
        : "Pause";

  const insightCards = [
    {
      title: "Can I afford it?",
      question: "Can I safely spend money on the thing I want?",
      metricLabel: "Safe to spend",
      metricValue: cashflow ? formatCurrency(cashflow.safeToSpend) : "—",
      insight: cashflow
        ? `Projected low balance is ${formatCurrency(cashflow.forecast.projectedLowBalance)} after upcoming bills and income.`
        : "Connect accounts to let Cashpile answer purchase decisions.",
      status: affordabilityStatus,
      href: "/cashflow",
      Icon: WalletCards,
      accent: "from-emerald-500/15 to-blue-500/10 border-emerald-500/20",
    },
    {
      title: "What am I still paying for?",
      question: "Which subscriptions are quietly draining cash?",
      metricLabel: "Subscriptions",
      metricValue: `${formatCurrency(subscriptionSummary.monthlyTotal)}/mo`,
      insight: subscriptionSummary.items.length
        ? `${subscriptionSummary.items.length} likely subscriptions · ${formatCurrency(subscriptionSummary.ytdTotal)} spent this year.`
        : "No recurring subscriptions detected yet. More history improves detection.",
      status: `${subscriptionSummary.items.length} found`,
      href: "/cashflow/recurring",
      Icon: CreditCard,
      accent: "from-yellow-500/15 to-orange-500/10 border-yellow-500/20",
    },
    {
      title: "Worker vs Owner income",
      question: "Am I earning like a worker or an owner?",
      metricLabel: "Owner-style income",
      metricValue: `${incomeMix.ownerPct}%`,
      insight: incomeMix.ownerIncome + incomeMix.wageIncome + incomeMix.unknownIncome > 0
        ? `${incomeMix.label}: ${formatCurrency(incomeMix.ownerIncome)} owner/passive income detected in recent history.`
        : "Import income transactions to classify wage, business, rental, and passive income.",
      status: incomeMix.label,
      href: "/books/transactions",
      Icon: PiggyBank,
      accent: "from-violet-500/15 to-blue-500/10 border-violet-500/20",
    },
    {
      title: "Where is my money leaking?",
      question: "What looks wasteful, unusual, or worth reviewing?",
      metricLabel: "Items to review",
      metricValue: moneyLeaks.alertCount.toLocaleString(),
      insight: moneyLeaks.biggestSpikePct > 0
        ? `${moneyLeaks.biggestSpikeLabel} is up ${moneyLeaks.biggestSpikePct}% versus the prior 30 days.`
        : moneyLeaks.duplicateCount > 0
          ? `${moneyLeaks.duplicateCount} possible duplicate charge patterns found.`
          : "No major money leaks detected from simple checks yet.",
      status: moneyLeaks.alertCount > 0 ? "Review" : "Looks calm",
      href: "/books/transactions",
      Icon: ShieldAlert,
      accent: "from-red-500/15 to-orange-500/10 border-red-500/20",
    },
    {
      title: "What should my budget be?",
      question: "If AI built my budget from real spending, what would it suggest?",
      metricLabel: "Suggested target",
      metricValue: aiBudget.needsLabels ? "Needs labels" : aiBudget.monthlyAverage > 0 ? `${formatCurrency(aiBudget.suggestedTarget)}/mo` : "—",
      insight: aiBudget.needsLabels
        ? "Cashpile can draft a better budget after uncategorized spending is labeled."
        : aiBudget.monthlyAverage > 0
          ? `Based on actual spending, start near ${formatCurrency(aiBudget.suggestedTarget)}. Biggest area: ${aiBudget.topCategoryLabel}.`
          : "Cashpile needs recent spending history to draft your first AI budget.",
      status: aiBudget.needsLabels ? "Needs labels" : `${aiBudget.confidence} confidence`,
      href: "/cashflow",
      Icon: CalendarCheck,
      accent: "from-cyan-500/15 to-emerald-500/10 border-cyan-500/20",
    },
  ];

  const spendingTrend = buildSpendingTrend(booksData.transactions);
  const recentTransactions = booksData.transactions
    .filter((row) => row.transaction_type === "debit")
    .slice(0, 5);
  const savingsProgress = cashflow
    ? Math.min(100, Math.max(12, Math.round((Math.max(cashflow.safeToSpend, 0) / Math.max(cashflow.forecast.projectedLowBalance + Math.max(cashflow.safeToSpend, 0), 1)) * 100)))
    : 0;
  const gremlinLine = cashflow && cashflow.safeToSpend > 0
    ? `You’re ${formatCurrency(cashflow.safeToSpend)} ahead.`
    : "I’ll help find leaks, protect cash, and make the next money move obvious.";
  const nextStashAmount = cashflow && cashflow.safeToSpend > 25 ? 25 : Math.max(0, Math.round((cashflow?.safeToSpend ?? 0) * 0.1));
  const moneyMoves = [
    { label: "Find leaks", detail: moneyLeaks.alertCount > 0 ? `${moneyLeaks.alertCount} items worth reviewing` : "No major leaks detected yet", href: "/books/transactions", Icon: Search },
    { label: "Protect rent money", detail: cashflow ? `Projected low: ${formatCurrency(cashflow.forecast.projectedLowBalance)}` : "Connect accounts for protection signals", href: "/cashflow", Icon: ShieldAlert },
    { label: "Boost savings", detail: aiBudget.needsLabels ? "Label spending to improve AI targets" : `Suggested target: ${formatCurrency(aiBudget.suggestedTarget)}/mo`, href: "/cashflow", Icon: Coins },
  ];

  return (
    <div className="cp-dashboard flex min-h-full flex-col bg-[#f7f5ef] text-[#101828]">
      <style dangerouslySetInnerHTML={{ __html: cashpileDashboardStyles }} />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(24,201,154,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_30%)]" />
      <div className="cp-dashboard-shell cp-dashboard-stack flex-1 px-4 pt-6 pb-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="cp-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="cp-eyebrow inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI finance dashboard
            </div>
            <h1 className="cp-title mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Cashpile Dashboard</h1>
            <p className="cp-subtitle mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              A street-smart little money creature that finds leaks, protects your cash, and helps you win.
            </p>
          </div>
          <div className="cp-nav-chips flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            {["Dashboard", "Accounts", "Goals", "Insights", "Transactions", "Ask AI"].map((item) => (
              <span key={item} className="cp-nav-chip rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm">
                {item}
              </span>
            ))}
          </div>
        </div>

        <section className="cp-panel overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
          <div className="cp-hero-grid grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="cp-hero-main relative p-6 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(24,201,154,0.10),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0),rgba(37,99,235,0.025))]" />
              <div className="cp-hero-content relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <MoneyGremlin />
                <div className="min-w-0 flex-1">
                  <p className="max-w-md text-base leading-relaxed text-slate-600">
                    A street-smart little money creature that finds leaks, protects your cash, and helps you win
                  </p>
                  <h2 className="cp-hero-title text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {gremlinLine}
                  </h2>
                  <p className="mt-3 text-2xl tracking-tight text-slate-950">
                    {nextStashAmount > 0 ? `Want me to stash ${formatCurrency(nextStashAmount)}?` : "Want me to find your next smart move?"}
                  </p>
                  <div className="cp-actions mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/cashflow"
                      className="cp-button-primary inline-flex items-center gap-2 rounded-full bg-[#18c99a] px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-[#12b589]"
                    >
                      {nextStashAmount > 0 ? `Stash ${formatCurrency(nextStashAmount)}` : "Protect cash"} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/books/transactions"
                      className="cp-button-secondary inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300"
                    >
                      Show me why
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="cp-side-panel border-t border-slate-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="cp-card-title text-lg font-black tracking-tight text-slate-950">AI Money Moves</h2>
                  <p className="cp-card-muted text-sm text-slate-500">Smart actions to help you win</p>
                </div>
              </div>
              <div className="space-y-3">
                {moneyMoves.map(({ label, detail, href, Icon }) => (
                  <Link key={label} href={href} className="cp-move flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/60">
                    <div className="cp-move-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-950">{label}</div>
                      <div className="text-xs leading-snug text-slate-500">{detail}</div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="cp-metric-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Safe to spend", value: cashflow ? formatCurrency(cashflow.safeToSpend) : "—", detail: affordabilityStatus, Icon: WalletCards, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
            { label: "Upcoming bills", value: cashflow ? "Covered" : "Needs data", detail: cashflow ? `Low balance ${formatCurrency(cashflow.forecast.projectedLowBalance)}` : "Connect accounts", Icon: CheckCircle2, color: "text-blue-700 bg-blue-50 border-blue-100" },
            { label: "Savings signal", value: `${savingsProgress}%`, detail: "Cashpile Progress", Icon: Umbrella, color: "text-amber-700 bg-amber-50 border-amber-100" },
            { label: "Subscriptions flagged", value: formatCurrency(subscriptionSummary.monthlyTotal), detail: `${subscriptionSummary.items.length} recurring items`, Icon: CreditCard, color: "text-red-700 bg-red-50 border-red-100" },
          ].map(({ label, value, detail, Icon, color }) => (
            <div key={label} className="cp-card rounded-3xl border border-white bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{detail}</span>
              </div>
              <div className="cp-metric-label mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
              <div className="cp-metric-value mt-1 font-mono text-3xl font-black tabular-nums text-slate-950">{value}</div>
            </div>
          ))}
        </section>

        <section className="cp-content-grid grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="cp-card rounded-[2rem] border border-white bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="cp-card-title text-lg font-black tracking-tight text-slate-950">Spending trend</h2>
                <p className="cp-card-muted text-sm text-slate-500">A clean read on recent cash outflow.</p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">Last 6 months</div>
            </div>
            <div className="cp-chart flex h-56 items-end gap-3 rounded-3xl border border-slate-100 bg-[#fbfaf7] p-4">
              {spendingTrend.map((point) => (
                <div key={point.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div
                    className="cp-bar rounded-t-2xl bg-gradient-to-t from-[#2563eb] to-[#18c99a] shadow-sm"
                    style={{ height: `${point.height}%` }}
                    title={formatCurrency(point.amount)}
                  />
                  <div className="text-center text-xs font-bold text-slate-500">{point.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="cp-card rounded-[2rem] border border-white bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="cp-card-title text-lg font-black tracking-tight text-slate-950">Recent transactions</h2>
                <p className="cp-card-muted text-sm text-slate-500">Still a financial app first.</p>
              </div>
              <Link href="/books/transactions" className="text-sm font-bold text-blue-600 no-underline">View all</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentTransactions.length ? recentTransactions.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
                    {(row.merchant || row.description || "?").slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-800">{row.merchant || row.description}</div>
                    <div className="text-xs text-slate-500">{row.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-slate-950">-{formatCurrency(Math.abs(Number(row.amount ?? 0)))}</div>
                    <div className="text-xs text-slate-500">{getCategoryName(row, booksData.categories)}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Import transactions to see recent activity here.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="cp-lower-grid grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="cp-card rounded-[2rem] border border-white bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="cp-card-title text-lg font-black tracking-tight text-slate-950">Cashpile Progress</h2>
                <p className="cp-card-muted text-sm text-slate-500">Subtle progress cues from existing money signals.</p>
              </div>
              <BadgeCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="space-y-4">
              {[
                { label: "Emergency shield", value: savingsProgress, Icon: Umbrella },
                { label: "Subscription leaks", value: subscriptionSummary.items.length ? Math.max(8, 100 - subscriptionSummary.items.length * 12) : 100, Icon: ShieldAlert },
                { label: "Budget confidence", value: aiBudget.confidence === "High" ? 86 : aiBudget.confidence === "Medium" ? 58 : 28, Icon: Gauge },
              ].map(({ label, value, Icon }) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <Icon className="h-4 w-4 text-emerald-600" />
                      {label}
                    </div>
                    <span className="font-mono font-bold text-slate-500">{value}%</span>
                  </div>
                  <div className="cp-progress-track h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="cp-progress-fill h-full rounded-full bg-gradient-to-r from-[#18c99a] to-[#2563eb]" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="cp-card rounded-[2rem] border border-white bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="cp-card-title text-lg font-black tracking-tight text-slate-950">Ask Cashpile</h2>
                <p className="cp-card-muted text-sm text-slate-500">Quick affordability check from existing cashflow data.</p>
              </div>
              <Landmark className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <AffordabilityForm variant="compact" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Your top money questions</h2>
            <p className="mt-1 text-xs text-slate-500">Existing answers, restyled with the new Cashpile visual system.</p>
          </div>
          <div className="cp-question-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {insightCards.map(({ title, question, metricLabel, metricValue, insight, status, href, Icon }) => (
              <Link key={title} href={href} className="cp-question-card group flex min-h-[235px] flex-col rounded-3xl border border-white bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-[#fbfaf7] text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">{status}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-black leading-tight text-slate-950">{title}</h3>
                  <p className="text-xs leading-relaxed text-slate-500">{question}</p>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{metricLabel}</div>
                  <div className="cp-metric-value mt-1 font-mono text-2xl font-black tabular-nums text-slate-950">{metricValue}</div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{insight}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <GremmyReminderModal reminders={gremmyReminders} openOnLogin={resolvedSearchParams?.gremmy === "welcome"} />
      <CashInputStrip />
    </div>
  );
}
