import { NextRequest, NextResponse } from "next/server";
import { saveTaxCategoryMapping } from "@/modules/books/actions/tax-workbook.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const body = await req.json();
    const categoryId = Number(body.categoryId);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }
    const categoryName = String(body.categoryName ?? "").trim();
    if (!categoryName) return NextResponse.json({ error: "categoryName is required" }, { status: 400 });

    const mapping = await saveTaxCategoryMapping({
      templateId: params.templateId,
      taxEntityId: body.taxEntityId ?? null,
      taxYear: body.taxYear ?? null,
      categoryId,
      categoryName,
      targetId: body.targetId ?? null,
      isIgnored: Boolean(body.isIgnored),
      deductionPercentageOverride: body.deductionPercentageOverride ?? null,
    });
    return NextResponse.json({ mapping }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to save mapping" }, { status: 500 });
  }
}
