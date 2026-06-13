import { NextRequest, NextResponse } from "next/server";
import { acceptAiReviewSuggestion, listAiReviewSuggestions } from "@/modules/books/actions/ai-review.actions";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? 40);
    const result = await listAiReviewSuggestions(Number.isFinite(limit) ? limit : 40);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to load AI review suggestions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await acceptAiReviewSuggestion({
      transactionIds: Array.isArray(body.transactionIds) ? body.transactionIds : [],
      pattern: String(body.pattern ?? ""),
      accountId: body.accountId ?? null,
      categoryId: body.categoryId ?? null,
      taxEntityId: body.taxEntityId ?? null,
      applyAccountDefault: Boolean(body.applyAccountDefault),
      createRule: body.createRule !== false,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to accept AI review suggestion" }, { status: 500 });
  }
}
