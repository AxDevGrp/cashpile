"use server";

import { createServerSupabaseClient } from "@cashpile/db";

export type TaxView = {
  id: string;
  user_id: string;
  uda_id: string;
  transaction_id: string;
  tax_amount: number | null;
  tax_description: string | null;
  tax_date: string | null;
  is_tax_deductible: boolean;
  business_percentage: number;
  deduction_percentage: number;
  tax_notes: string | null;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  books_transactions?: {
    id: string;
    description: string | null;
    merchant: string | null;
    amount: number;
    date: string;
    transaction_type: string;
  };
  books_categories?: {
    id: number;
    name: string;
    category_type: string;
  };
};

export type TaxReport = {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  taxableIncome: number;
  estimatedTax: number;
  byCategory: Array<{
    categoryId: number | null;
    categoryName: string;
    type: string;
    total: number;
    count: number;
  }>;
  transactions: TaxView[];
};

export async function listTaxViews(udaId: string, year?: number): Promise<TaxView[]> {
  const supabase = await createServerSupabaseClient();

  let q = (supabase as any)
    .from("books_tax_transaction_views")
    .select(`*, books_transactions(id, description, merchant, amount, date, transaction_type), books_categories(id, name, category_type)`)
    .eq("uda_id", udaId)
    .order("tax_date", { ascending: false });

  if (year) {
    q = q.gte("tax_date", `${year}-01-01`).lte("tax_date", `${year}-12-31`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TaxView[];
}

export async function assignTransactions(params: {
  transactionIds: string[];
  udaId: string;
  businessPct?: number;
  deductionPct?: number;
  isDeductible?: boolean;
  notes?: string;
  categoryId?: number;
}): Promise<{ assigned: number; skipped: number }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: txns, error: txnError } = await (supabase as any)
    .from("books_transactions")
    .select("id, amount, date, type")
    .in("id", params.transactionIds);
  if (txnError) throw new Error(txnError.message);

  const businessPct = params.businessPct ?? 100;
  const deductionPct = params.deductionPct ?? 100;

  const rows = (txns ?? []).map((t: any) => ({
    user_id: user.id,
    uda_id: params.udaId,
    transaction_id: t.id,
    tax_amount: Math.abs(t.amount) * (businessPct / 100),
    tax_date: t.date,
    is_tax_deductible: params.isDeductible ?? false,
    business_percentage: businessPct,
    deduction_percentage: deductionPct,
    tax_notes: params.notes ?? null,
    category_id: params.categoryId ?? null,
  }));

  let assigned = 0;
  let skipped = 0;

  for (const row of rows) {
    const { error } = await (supabase as any)
      .from("books_tax_transaction_views")
      .upsert(row, { onConflict: "uda_id,transaction_id", ignoreDuplicates: true });
    if (error && error.code === "23505") {
      skipped++;
    } else if (error) {
      console.warn("tax assign skip:", error.message);
      skipped++;
    } else {
      assigned++;
    }
  }

  return { assigned, skipped };
}

export async function unassignTransactions(params: {
  transactionIds: string[];
  udaId: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("books_tax_transaction_views")
    .delete()
    .eq("uda_id", params.udaId)
    .in("transaction_id", params.transactionIds);
  if (error) throw new Error(error.message);
}

export async function generateTaxReport(params: {
  udaId: string;
  year: number;
}): Promise<TaxReport> {
  const views = await listTaxViews(params.udaId, params.year);

  const byCategory: Record<string, {
    categoryId: number | null;
    categoryName: string;
    type: string;
    total: number;
    count: number;
  }> = {};

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const v of views) {
    const txn = v.books_transactions;
    if (!txn) continue;

    const catId = v.category_id ?? null;
    const catName = v.books_categories?.name ?? "Uncategorized";
    const catType = v.books_categories?.category_type ?? (txn.transaction_type === "credit" ? "income" : "expense");
    const amount = v.tax_amount ?? Math.abs(txn.amount) * (v.business_percentage / 100);
    const key = String(catId ?? "uncategorized");

    if (!byCategory[key]) {
      byCategory[key] = { categoryId: catId, categoryName: catName, type: catType, total: 0, count: 0 };
    }
    byCategory[key].total += amount;
    byCategory[key].count++;

    if (txn.transaction_type === "credit" || txn.amount > 0) {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
    }
  }

  const deductibleExpenses = views
    .filter(v => v.is_tax_deductible)
    .reduce((sum, v) => {
      const amount = v.tax_amount ??
        Math.abs(v.books_transactions?.amount ?? 0) *
        (v.business_percentage / 100) *
        (v.deduction_percentage / 100);
      return sum + amount;
    }, 0);

  const netIncome = totalIncome - totalExpenses;
  const taxableIncome = Math.max(0, netIncome - deductibleExpenses);
  const estimatedTax = taxableIncome * 0.25;

  return {
    totalIncome,
    totalExpenses,
    netIncome,
    taxableIncome,
    estimatedTax,
    byCategory: Object.values(byCategory),
    transactions: views,
  };
}

export async function getTaxSummaryForUdas(
  udaIds: string[],
  year: number
): Promise<Record<string, { totalIncome: number; totalExpenses: number; transactionCount: number }>> {
  if (!udaIds.length) return {};

  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("books_tax_transaction_views")
    .select(`uda_id, tax_amount, business_percentage, books_transactions(amount, transaction_type)`)
    .in("uda_id", udaIds)
    .gte("tax_date", `${year}-01-01`)
    .lte("tax_date", `${year}-12-31`);

  if (error) throw new Error(error.message);

  const result: Record<string, { totalIncome: number; totalExpenses: number; transactionCount: number }> = {};
  for (const row of (data ?? [])) {
    if (!result[row.uda_id]) {
      result[row.uda_id] = { totalIncome: 0, totalExpenses: 0, transactionCount: 0 };
    }
    const txn = row.books_transactions;
    const amount = row.tax_amount ?? Math.abs(txn?.amount ?? 0) * ((row.business_percentage ?? 100) / 100);
    result[row.uda_id].transactionCount++;
    if (txn?.transaction_type === "credit" || (txn?.amount ?? 0) > 0) {
      result[row.uda_id].totalIncome += amount;
    } else {
      result[row.uda_id].totalExpenses += amount;
    }
  }
  return result;
}
