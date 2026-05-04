import { NextRequest, NextResponse } from "next/server";
import { listTransactions } from "@/modules/books/actions/transaction.actions";

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

  if (udaId) params.udaId = udaId;
  if (taxEntityId) params.taxEntityId = taxEntityId;
  if (accountId) params.accountId = accountId;
  if (categoryId) params.categoryId = categoryId;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (limit) params.limit = parseInt(limit);
  if (offset) params.offset = parseInt(offset);

  try {
    const { data, count } = await listTransactions(params);
    return NextResponse.json({ transactions: data, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
