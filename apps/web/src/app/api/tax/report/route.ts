import { NextRequest, NextResponse } from "next/server";
import { generateTaxReport } from "@/modules/books/actions/tax.actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Support both new taxEntityId and deprecated udaId
  const taxEntityId = searchParams.get("taxEntityId") ?? searchParams.get("udaId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!taxEntityId) return NextResponse.json({ error: "taxEntityId required" }, { status: 400 });

  try {
    const report = await generateTaxReport({ taxEntityId, year });
    return NextResponse.json(report);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
