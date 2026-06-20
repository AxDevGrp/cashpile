import { NextRequest, NextResponse } from "next/server";
import { generateMappedTaxWorkbook } from "@/modules/books/actions/tax-workbook.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const body = await req.json();
    const taxEntityId = String(body.taxEntityId ?? "");
    const taxEntityName = String(body.taxEntityName ?? "tax-entity");
    const year = Number(body.year ?? new Date().getFullYear());
    if (!taxEntityId) return NextResponse.json({ error: "taxEntityId is required" }, { status: 400 });

    const result = await generateMappedTaxWorkbook({
      templateId: params.templateId,
      taxEntityId,
      taxEntityName,
      year,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename.replace(/"/g, "")}"`,
        "X-Cashpile-Export-Id": result.exportId,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to generate workbook" }, { status: 500 });
  }
}
