/**
 * Report Service — Books module
 * Computes P&L, Cash Flow, and Schedule E on-demand from books_transactions.
 * No materialized views — all computed server-side per request.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PnLReport, PnLRow, CashFlowReport, CashFlowMonth, ScheduleEReport } from "../types";

export class ReportService {
  constructor(private supabase: SupabaseClient) {}

  // ─── P&L ────────────────────────────────────────────────────────────────

  async getPnL(
    userId: string,
    entityId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<PnLReport> {
    const { data: txns, error } = await this.supabase
      .from("books_transactions")
      .select(`id, date, amount, type, category_id, is_transfer,
        books_categories(id, name, type)`)
      .eq("user_id", userId)
      .eq("entity_id", entityId)
      .eq("is_transfer", false)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw new Error(error.message);

    const rowMap = new Map<string, PnLRow>();

    for (const tx of txns ?? []) {
      const cat = (tx as any).books_categories;
      const catId = tx.category_id ?? "__uncategorized__";
      const catName = cat?.name ?? "Uncategorized";
      const catType: "income" | "expense" = cat?.type === "income" ? "income" : "expense";
      const month = tx.date.slice(0, 7); // YYYY-MM

      if (!rowMap.has(catId)) {
        rowMap.set(catId, { categoryId: catId, categoryName: catName, type: catType, total: 0, monthlyBreakdown: {} });
      }

      const row = rowMap.get(catId)!;
      const amt = Math.abs(tx.amount);
      row.total += amt;
      row.monthlyBreakdown[month] = (row.monthlyBreakdown[month] ?? 0) + amt;
    }

    const rows = Array.from(rowMap.values());
    const income = rows.filter((r) => r.type === "income");
    const expenses = rows.filter((r) => r.type === "expense");

    const totalIncome = income.reduce((s, r) => s + r.total, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.total, 0);

    return { entityId, periodStart, periodEnd, totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses, rows };
  }

  // ─── Cash Flow ──────────────────────────────────────────────────────────

  async getCashFlow(
    userId: string,
    entityId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<CashFlowReport> {
    const { data: txns, error } = await this.supabase
      .from("books_transactions")
      .select("date, amount, type, is_transfer")
      .eq("user_id", userId)
      .eq("entity_id", entityId)
      .eq("is_transfer", false)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);

    const monthMap = new Map<string, CashFlowMonth>();

    for (const tx of txns ?? []) {
      const month = tx.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { month, inflows: 0, outflows: 0, net: 0 });
      const m = monthMap.get(month)!;
      if (tx.amount >= 0) {
        m.inflows += tx.amount;
      } else {
        m.outflows += Math.abs(tx.amount);
      }
      m.net = m.inflows - m.outflows;
    }

    return {
      entityId,
      periodStart,
      periodEnd,
      months: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  // ─── Schedule E ─────────────────────────────────────────────────────────

  async getScheduleE(userId: string, entityId: string, taxYear: number): Promise<ScheduleEReport> {
    const periodStart = `${taxYear}-01-01`;
    const periodEnd = `${taxYear}-12-31`;

    const { data: udas, error: udaErr } = await this.supabase
      .from("books_udas")
      .select("id, name")
      .eq("user_id", userId)
      .eq("entity_id", entityId);

    if (udaErr) throw new Error(udaErr.message);

    const properties = await Promise.all(
      (udas ?? []).map(async (uda) => {
        const { data: accounts } = await this.supabase
          .from("books_financial_accounts")
          .select("id")
          .eq("uda_id", uda.id);

        const accountIds = (accounts ?? []).map((a) => a.id);
        if (accountIds.length === 0) {
          return { udaId: uda.id, udaName: uda.name, income: 0, expenses: {}, netIncome: 0 };
        }

        const { data: txns } = await this.supabase
          .from("books_transactions")
          .select(`amount, type, books_categories(name, type, tax_category)`)
          .eq("user_id", userId)
          .eq("is_transfer", false)
          .in("account_id", accountIds)
          .gte("date", periodStart)
          .lte("date", periodEnd);

        let income = 0;
        const expenses: Record<string, number> = {};

        for (const tx of txns ?? []) {
          const cat = (tx as any).books_categories;
          const amt = Math.abs(tx.amount);
          if (cat?.type === "income") {
            income += amt;
          } else {
            const label = cat?.name ?? "Other";
            expenses[label] = (expenses[label] ?? 0) + amt;
          }
        }

        const totalExpenses = Object.values(expenses).reduce((s, v) => s + v, 0);
        return { taxEntityId: uda.id, taxEntityName: uda.name, income, expenses, netIncome: income - totalExpenses };
      })
    );

    return { entityId, taxYear, properties };
  }
}
