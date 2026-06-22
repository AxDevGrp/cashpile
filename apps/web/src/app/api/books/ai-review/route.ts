import { NextRequest, NextResponse } from "next/server";
import { acceptAiReviewSuggestion, applyAiInstruction, listAiReviewSuggestions } from "@/modules/books/actions/ai-review.actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? 40);
    const accountId = searchParams.get("accountId");
    const result = await listAiReviewSuggestions(Number.isFinite(limit) ? limit : 40, accountId);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to load AI review suggestions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.mode === "instruction") {
      const result = await applyAiInstruction({
        instruction: String(body.instruction ?? ""),
        accountId: body.accountId ?? null,
        pattern: body.pattern ?? null,
        categoryId: body.categoryId ?? null,
        taxEntityId: body.taxEntityId ?? null,
        applyToExisting: body.applyToExisting !== false,
        setAccountDefault: body.setAccountDefault !== false,
        dryRun: body.dryRun === true,
      });
      return NextResponse.json(result);
    }

    const result = await acceptAiReviewSuggestion({
      transactionIds: Array.isArray(body.transactionIds) ? body.transactionIds : [],
      pattern: String(body.pattern ?? ""),
      accountId: body.accountId ?? null,
      targetAccountId: body.targetAccountId ?? null,
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
