import { NextRequest, NextResponse } from "next/server";
import {
  listTaxWorkbookTemplates,
  uploadAndAnalyzeTaxWorkbook,
} from "@/modules/books/actions/tax-workbook.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await listTaxWorkbookTemplates();
    return NextResponse.json({ templates });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to load tax workbook templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const result = await uploadAndAnalyzeTaxWorkbook(formData);
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unable to upload tax workbook" }, { status: 500 });
  }
}
