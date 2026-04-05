import { NextRequest, NextResponse } from "next/server";
import { generateTaxReport } from "@/modules/books/actions/tax.actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const udaId = searchParams.get("udaId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!udaId) return NextResponse.json({ error: "udaId required" }, { status: 400 });

  try {
    const report = await generateTaxReport({ udaId, year });
    return NextResponse.json(report);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
