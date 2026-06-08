import { createServiceRoleClient } from "@cashpile/db";
import { checkAffordability, getCashflowSnapshot, detectRecurringItems } from "@cashpile/ai";
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
    .select("id, date, description, merchant, amount, transaction_type, category_id, financial_account_id, is_transfer, notes, created_at", { count: "exact" })
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
      books_transactions(id, date, description, merchant, amount, transaction_type),
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

async function generateBriefing(userId: string) {
  const [books, cashflow] = await Promise.all([
    listBooksTransactions(userId, { dateFrom: periodStartDate("mtd"), limit: 100 }),
    getCashflowSnapshot(userId, 30),
  ]);
  const income = (books.transactions as any[]).filter((t) => t.transaction_type === "credit").reduce((sum, t) => sum + Math.abs(Number(t.amount ?? 0)), 0);
  const expenses = (books.transactions as any[]).filter((t) => t.transaction_type === "debit").reduce((sum, t) => sum + Math.abs(Number(t.amount ?? 0)), 0);
  const netCashFlow = income - expenses;
  return {
    briefing: `Books MTD net cash flow is $${netCashFlow.toFixed(2)} across ${books.count} transactions. Safe-to-spend is $${cashflow.safeToSpend.toFixed(2)} with a projected low balance of $${cashflow.forecast.projectedLowBalance.toFixed(2)}.`,
    data: { books: { income, expenses, netCashFlow, count: books.count }, cashflow },
  };
}

async function runCapability(userId: string, name: string, input: Record<string, any>) {
  switch (name) {
    case "cashpile.briefing.generate": return generateBriefing(userId);
    case "cashflow.snapshot.get": return getCashflowSnapshot(userId, limitNumber(input.horizonDays, 30, 90));
    case "cashflow.affordability.check": return checkAffordability(userId, { amount: Number(input.amount), description: input.description, date: input.date, horizonDays: limitNumber(input.horizonDays, 30, 90) });
    case "cashflow.recurring_items.list": return { recurringItems: await detectRecurringItems(userId) };
    case "books.transactions.list": return listBooksTransactions(userId, input);
    case "books.accounts.list": return listBooksAccounts(userId, input);
    case "books.categories.list": return listBooksCategories(userId);
    case "books.transactions.categorize": return categorizeTransactions(userId, input);
    case "tax.report.generate": return generateTaxReport(userId, input);
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
    { uri: "cashpile://cashflow/snapshot", name: "Cash flow snapshot", scopes: ["books:read"] },
    { uri: "cashpile://books/accounts", name: "Books accounts", scopes: ["books:read"] },
    { uri: "cashpile://books/transactions", name: "Books transactions", scopes: ["books:read"] },
    { uri: "cashpile://books/categories", name: "Books categories", scopes: ["books:read"] },
    { uri: "cashpile://tax/reports", name: "Tax reports", scopes: ["tax:read"] },
  ];
}

export { AGENT_CAPABILITIES };
