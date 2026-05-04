import { createServiceRoleClient } from "@cashpile/db";
import { AGENT_CAPABILITIES, getAgentCapability } from "./capabilities";
import { auditAgentCall } from "./audit";
import { createConfirmationToken, verifyConfirmationToken } from "./confirmation";
import { hasScopes } from "./auth";
import type { AgentCallResult, AgentPrincipal } from "./types";

function limitNumber(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function offsetNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function periodStartDate(period: "mtd" | "ytd" | "last30" = "mtd") {
  const now = new Date();
  if (period === "mtd") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  if (period === "ytd") return `${now.getFullYear()}-01-01`;
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

async function listBooksTransactions(userId: string, input: Record<string, any>) {
  const limit = limitNumber(input.limit, 50, 100);
  const offset = offsetNumber(input.offset);
  const supabase = createServiceRoleClient() as any;

  let q = supabase
    .from("books_transactions")
    .select("id, date, description, merchant, amount, type, category_id, financial_account_id, is_transfer, notes, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.dateFrom) q = q.gte("date", input.dateFrom);
  if (input.dateTo) q = q.lte("date", input.dateTo);
  if (input.accountId) q = q.eq("financial_account_id", input.accountId);
  if (input.categoryId) q = q.eq("category_id", input.categoryId);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { transactions: data ?? [], count: count ?? 0, limit, offset };
}

async function listBooksAccounts(userId: string, input: Record<string, any>) {
  const supabase = createServiceRoleClient() as any;
  let q = supabase
    .from("books_financial_accounts")
    .select("id, name, account_type, institution_name, current_balance, tax_entity_id, is_active, updated_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (input.taxEntityId) q = q.eq("tax_entity_id", input.taxEntityId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { accounts: data ?? [] };
}

async function listBooksCategories(userId: string) {
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("books_categories")
    .select("id, name, category_type, parent_id")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return { categories: data ?? [] };
}

async function previewCategorize(userId: string, input: Record<string, any>) {
  const ids = Array.isArray(input.transactionIds) ? input.transactionIds.slice(0, 200) : [];
  const supabase = createServiceRoleClient() as any;
  const { data: txns, error: txErr } = await supabase
    .from("books_transactions")
    .select("id, date, description, amount, category_id")
    .eq("user_id", userId)
    .in("id", ids);
  if (txErr) throw new Error(txErr.message);

  const { data: category, error: catErr } = await supabase
    .from("books_categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("id", input.categoryId)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);

  return {
    action: "categorize_transactions",
    transactionCount: txns?.length ?? 0,
    requestedCount: ids.length,
    category,
    sample: (txns ?? []).slice(0, 10),
  };
}

async function categorizeTransactions(userId: string, input: Record<string, any>) {
  const ids = Array.isArray(input.transactionIds) ? input.transactionIds.slice(0, 200) : [];
  if (!ids.length || !input.categoryId) throw new Error("transactionIds and categoryId are required");
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("books_transactions")
    .update({ category_id: input.categoryId, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  return { updated: data?.length ?? 0 };
}

async function generateTaxReport(userId: string, input: Record<string, any>) {
  if (!input.taxEntityId) throw new Error("taxEntityId is required");
  const year = Number.isFinite(Number(input.year)) ? Number(input.year) : new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const supabase = createServiceRoleClient() as any;

  const { data, error } = await supabase
    .from("books_tax_transaction_views")
    .select(`
      id, tax_amount, tax_description, tax_date, is_tax_deductible, business_percentage, deduction_percentage, tax_notes, category_id,
      books_transactions(id, date, description, merchant, amount, type),
      books_categories(id, name)
    `)
    .eq("user_id", userId)
    .eq("tax_entity_id", input.taxEntityId)
    .gte("tax_date", start)
    .lte("tax_date", end)
    .order("tax_date", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const deductibleTotal = rows
    .filter((row: any) => row.is_tax_deductible)
    .reduce((sum: number, row: any) => sum + Math.abs(Number(row.tax_amount ?? row.books_transactions?.amount ?? 0)), 0);

  return {
    year,
    taxEntityId: input.taxEntityId,
    summary: { transactionCount: rows.length, deductibleTotal: +deductibleTotal.toFixed(2) },
    transactions: rows,
  };
}

async function getTradesSnapshot(userId: string) {
  const supabase = createServiceRoleClient() as any;
  const { data: accounts, error } = await supabase
    .from("trades_prop_accounts")
    .select("id, firm_name, account_label, starting_balance, current_balance, status, max_total_drawdown_pct")
    .eq("user_id", userId)
    .neq("status", "inactive");
  if (error) throw new Error(error.message);

  const list = accounts ?? [];
  const accountIds = list.map((account: any) => account.id);
  let recentTrades: any[] = [];
  if (accountIds.length > 0) {
    const { data } = await supabase
      .from("trades_entries")
      .select("instrument, direction, net_pnl, entry_time")
      .in("account_id", accountIds)
      .eq("is_open", false)
      .order("entry_time", { ascending: false })
      .limit(20);
    recentTrades = data ?? [];
  }

  const accountSummaries = list.map((account: any) => {
    const pnl = Number(account.current_balance ?? 0) - Number(account.starting_balance ?? 0);
    const drawdownPct = Number(account.starting_balance ?? 0) > 0
      ? ((Number(account.starting_balance) - Number(account.current_balance)) / Number(account.starting_balance)) * 100
      : 0;
    return {
      id: account.id,
      label: `${account.firm_name} ${account.account_label ?? ""}`.trim(),
      pnl: +pnl.toFixed(2),
      drawdownPct: +drawdownPct.toFixed(2),
      maxDrawdownPct: account.max_total_drawdown_pct,
      status: account.status,
      atRisk: drawdownPct >= Number(account.max_total_drawdown_pct ?? 0) * 0.8,
    };
  });

  const wins = recentTrades.filter((trade) => Number(trade.net_pnl ?? 0) > 0).length;
  return {
    accountCount: list.length,
    totalPnl: +accountSummaries.reduce((sum: number, account: any) => sum + account.pnl, 0).toFixed(2),
    breachedCount: list.filter((account: any) => account.status === "breached").length,
    winRate: recentTrades.length ? +((wins / recentTrades.length) * 100).toFixed(1) : null,
    accounts: accountSummaries,
    recentTrades: recentTrades.slice(0, 5),
  };
}

async function listPulseEvents(input: Record<string, any>) {
  const limit = limitNumber(input.limit, 10, 50);
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("pulse_events")
    .select("id, title, summary, category, severity, affected_instruments, published_at, source")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const instruments = Array.isArray(input.instruments) ? input.instruments : [];
  const events = instruments.length
    ? (data ?? []).filter((event: any) => Array.isArray(event.affected_instruments) && instruments.some((instrument: string) => event.affected_instruments.includes(instrument)))
    : data ?? [];
  return { events, count: events.length };
}

async function listPulseAlerts(userId: string, input: Record<string, any>) {
  const supabase = createServiceRoleClient() as any;
  let q = supabase
    .from("pulse_alerts")
    .select("id, instrument, message, severity, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (input.unreadOnly !== false) q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { alerts: data ?? [], unreadCount: (data ?? []).filter((alert: any) => !alert.read_at).length };
}

async function generateBriefing(userId: string) {
  const [books, trades, pulse] = await Promise.all([
    listBooksTransactions(userId, { dateFrom: periodStartDate("mtd"), limit: 100 }),
    getTradesSnapshot(userId),
    listPulseAlerts(userId, { unreadOnly: true }),
  ]);
  const income = (books.transactions as any[]).filter((t) => t.type === "credit").reduce((sum, t) => sum + Math.abs(Number(t.amount ?? 0)), 0);
  const expenses = (books.transactions as any[]).filter((t) => t.type === "debit").reduce((sum, t) => sum + Math.abs(Number(t.amount ?? 0)), 0);
  return {
    briefing: `Books MTD net cash flow is $${(income - expenses).toFixed(2)} across ${books.count} transactions. Trades total P&L is $${trades.totalPnl.toFixed(2)} across ${trades.accountCount} active accounts. Pulse has ${pulse.unreadCount} unread alerts.`,
    data: { books: { income, expenses, netCashFlow: income - expenses, count: books.count }, trades, pulse },
  };
}

async function runCapability(userId: string, name: string, input: Record<string, any>) {
  switch (name) {
    case "cashpile.briefing.generate": return generateBriefing(userId);
    case "books.transactions.list": return listBooksTransactions(userId, input);
    case "books.accounts.list": return listBooksAccounts(userId, input);
    case "books.categories.list": return listBooksCategories(userId);
    case "books.transactions.categorize": return categorizeTransactions(userId, input);
    case "tax.report.generate": return generateTaxReport(userId, input);
    case "trades.snapshot.get": return getTradesSnapshot(userId);
    case "pulse.events.list": return listPulseEvents(input);
    case "pulse.alerts.list": return listPulseAlerts(userId, input);
    default: throw new Error(`Unknown capability: ${name}`);
  }
}

export async function callAgentCapability(params: {
  principal: AgentPrincipal;
  name: string;
  input?: Record<string, any>;
  confirmationToken?: string;
  requestId?: string | null;
}): Promise<AgentCallResult> {
  const capability = getAgentCapability(params.name);
  const input = params.input ?? {};

  if (!capability) return { ok: false, capability: params.name, error: "Unknown capability" };
  if (!hasScopes(params.principal, capability.requiredScopes)) {
    return { ok: false, capability: capability.name, error: `Missing required scopes: ${capability.requiredScopes.join(", ")}` };
  }

  try {
    if (capability.requiresConfirmation) {
      if (!params.confirmationToken) {
        const preview = capability.name === "books.transactions.categorize"
          ? await previewCategorize(params.principal.userId, input)
          : { input };
        const confirmationToken = createConfirmationToken({ userId: params.principal.userId, capability: capability.name, input });
        await auditAgentCall({ principal: params.principal, capability: capability.name, kind: capability.kind, status: "preview", input, result: preview, requestId: params.requestId });
        return { ok: false, capability: capability.name, requiresConfirmation: true, confirmationToken, preview };
      }
      if (!verifyConfirmationToken(params.confirmationToken, { userId: params.principal.userId, capability: capability.name, input })) {
        return { ok: false, capability: capability.name, error: "Invalid or expired confirmation token" };
      }
    }

    const result = await runCapability(params.principal.userId, capability.name, input);
    await auditAgentCall({ principal: params.principal, capability: capability.name, kind: capability.kind, status: "success", input, result, requestId: params.requestId });
    return { ok: true, capability: capability.name, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Capability execution failed";
    await auditAgentCall({ principal: params.principal, capability: capability.name, kind: capability.kind, status: "error", input, error: message, requestId: params.requestId });
    return { ok: false, capability: capability.name, error: message };
  }
}

export function getAgentResources() {
  return [
    { uri: "cashpile://books/accounts", name: "Books accounts", scopes: ["books:read"] },
    { uri: "cashpile://books/transactions", name: "Books transactions", scopes: ["books:read"] },
    { uri: "cashpile://books/categories", name: "Books categories", scopes: ["books:read"] },
    { uri: "cashpile://tax/reports", name: "Tax reports", scopes: ["tax:read"] },
    { uri: "cashpile://trades/snapshot", name: "Trades snapshot", scopes: ["trades:read"] },
    { uri: "cashpile://pulse/events", name: "Pulse events", scopes: ["pulse:read"] },
    { uri: "cashpile://pulse/alerts", name: "Pulse alerts", scopes: ["pulse:read"] },
  ];
}

export { AGENT_CAPABILITIES };
