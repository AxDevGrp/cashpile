import { NextRequest, NextResponse } from "next/server";
import { requireTaxModuleAccess } from "@/lib/tax-access";
import {
  getTaxWorkbookMappingReview,
  listTaxWorkbookTargets,
} from "@/modules/books/actions/tax-workbook.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    await requireTaxModuleAccess();
    const { searchParams } = new URL(req.url);
    const taxEntityId = searchParams.get("taxEntityId");
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());
    if (!taxEntityId) return NextResponse.json({ error: "taxEntityId is required" }, { status: 400 });

    const [review, targets] = await Promise.all([
      getTaxWorkbookMappingReview({ templateId: params.templateId, taxEntityId, year }),
      listTaxWorkbookTargets(params.templateId),
    ]);

    return NextResponse.json({ ...review, targets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to load mapping review" }, { status: 500 });
  }
}
