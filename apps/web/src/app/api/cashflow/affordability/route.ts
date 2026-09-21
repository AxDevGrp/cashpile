import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { checkAffordability } from "@cashpile/ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (body?.scenarioType !== undefined && body.scenarioType !== "purchase" && body.scenarioType !== "savings_transfer") {
    return NextResponse.json({ error: "scenarioType must be purchase or savings_transfer" }, { status: 400 });
  }
  if (body?.reserveAccountId !== undefined && typeof body.reserveAccountId !== "string") {
    return NextResponse.json({ error: "reserveAccountId must be a string" }, { status: 400 });
  }

  let result;
  try {
    result = await checkAffordability(user.id, {
      amount,
      description: typeof body?.description === "string" ? body.description : undefined,
      date: typeof body?.date === "string" ? body.date : undefined,
      horizonDays: Number.isFinite(Number(body?.horizonDays)) ? Number(body.horizonDays) : 30,
      scenarioType: body?.scenarioType === "savings_transfer" ? "savings_transfer" : "purchase",
      reserveAccountId: typeof body?.reserveAccountId === "string" ? body.reserveAccountId : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to check affordability";
    const status = message.startsWith("purchaseDate") || message.startsWith("reserveAccountId") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json(result);
}
