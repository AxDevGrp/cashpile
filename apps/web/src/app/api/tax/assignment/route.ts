import { NextRequest, NextResponse } from "next/server";
import { assignTransactions, unassignTransactions } from "@/modules/books/actions/tax.actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Support both new taxEntityId and deprecated udaId
  const taxEntityId = body.taxEntityId ?? body.udaId;
  const { transactionIds, businessPct, deductionPct, isDeductible, notes, categoryId } = body;

  if (!transactionIds?.length || !taxEntityId) {
    return NextResponse.json({ error: "transactionIds and taxEntityId required" }, { status: 400 });
  }

  try {
    const result = await assignTransactions({
      transactionIds,
      taxEntityId,
      businessPct,
      deductionPct,
      isDeductible,
      notes,
      categoryId,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  // Support both new taxEntityId and deprecated udaId
  const taxEntityId = body.taxEntityId ?? body.udaId;
  const { transactionIds } = body;

  if (!transactionIds?.length || !taxEntityId) {
    return NextResponse.json({ error: "transactionIds and taxEntityId required" }, { status: 400 });
  }

  try {
    await unassignTransactions({ transactionIds, taxEntityId });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
