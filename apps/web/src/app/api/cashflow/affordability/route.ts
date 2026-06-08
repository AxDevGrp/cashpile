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

  const result = await checkAffordability(user.id, {
    amount,
    description: typeof body?.description === "string" ? body.description : undefined,
    date: typeof body?.date === "string" ? body.date : undefined,
    horizonDays: Number.isFinite(Number(body?.horizonDays)) ? Number(body.horizonDays) : 30,
  });
  return NextResponse.json(result);
}
