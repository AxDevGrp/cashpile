import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { getCashflowSnapshot } from "@cashpile/ai";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const horizonDays = Number(req.nextUrl.searchParams.get("horizonDays") ?? 30);
  const snapshot = await getCashflowSnapshot(user.id, Number.isFinite(horizonDays) ? horizonDays : 30);
  return NextResponse.json(snapshot);
}
