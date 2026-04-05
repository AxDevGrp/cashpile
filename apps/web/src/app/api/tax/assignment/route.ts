import { NextRequest, NextResponse } from "next/server";
import { assignTransactions, unassignTransactions } from "@/modules/books/actions/tax.actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { transactionIds, udaId, businessPct, deductionPct, isDeductible, notes, categoryId } = body;

  if (!transactionIds?.length || !udaId) {
    return NextResponse.json({ error: "transactionIds and udaId required" }, { status: 400 });
  }

  try {
    const result = await assignTransactions({
      transactionIds,
      udaId,
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
  const { transactionIds, udaId } = body;

  if (!transactionIds?.length || !udaId) {
    return NextResponse.json({ error: "transactionIds and udaId required" }, { status: 400 });
  }

  try {
    await unassignTransactions({ transactionIds, udaId });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
