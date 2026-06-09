import { NextRequest, NextResponse } from "next/server";
import { bulkCategorizeUncategorizedTransactions, bulkUpdateTransactions, listTransactions, updateTransaction } from "@/modules/books/actions/transaction.actions";
import { listCategories } from "@/modules/books/actions/category.actions";
import { applyCategoryRuleToUncategorizedTransactions, learnCategoryRuleFromTransaction } from "@/modules/books/actions/category-rule.actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params: Parameters<typeof listTransactions>[0] = {};

  const udaId = searchParams.get("udaId");
  const taxEntityId = searchParams.get("taxEntityId");
  const accountId = searchParams.get("accountId");
  const categoryId = searchParams.get("categoryId");
  const dateFrom = searchParams.get("dateFrom") ?? searchParams.get("from");
  const dateTo = searchParams.get("dateTo") ?? searchParams.get("to");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");
  const filter = searchParams.get("filter");
  const search = searchParams.get("search");

  if (udaId) params.udaId = udaId;
  if (taxEntityId) params.taxEntityId = taxEntityId;
  if (accountId) params.accountId = accountId;
  if (categoryId) params.categoryId = categoryId;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (search) params.search = search;
  if (limit) params.limit = parseInt(limit);
  if (offset) params.offset = parseInt(offset);
  if (filter === "uncategorized" || filter === "categorized") params.filter = filter;

  try {
    const [{ data, count }, categories] = await Promise.all([listTransactions(params), listCategories()]);
    return NextResponse.json({ transactions: data, count, categories });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await bulkCategorizeUncategorizedTransactions({
      limit: typeof body.limit === "number" ? body.limit : 5000,
      useAI: body.useAI !== false,
      minConfidence: typeof body.minConfidence === "number" ? body.minConfidence : 0.85,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) {
      const ids = body.ids.filter((id: unknown) => typeof id === "string" && id.length > 0);
      if (ids.length === 0) {
        return NextResponse.json({ error: "At least one transaction id is required" }, { status: 400 });
      }
      await bulkUpdateTransactions(ids, {
        category_id: body.categoryId ?? null,
      } as any);
      return NextResponse.json({ updated: ids.length });
    }

    if (!body?.id) {
      return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
    }
    const updated = await updateTransaction(body.id, {
      category_id: body.categoryId ?? null,
    } as any);
    let rule = null;
    let appliedMatches = 0;
    if (body.learnRule !== false && body.categoryId) {
      try {
        rule = await learnCategoryRuleFromTransaction(body.id, body.categoryId);
        if (rule?.id) {
          const applyResult = await applyCategoryRuleToUncategorizedTransactions(rule.id);
          appliedMatches = applyResult.applied;
        }
      } catch (learnError) {
        console.warn("[category-rules] Failed to save learned rule:", learnError);
      }
    }
    return NextResponse.json({ transaction: updated, rule, appliedMatches });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
