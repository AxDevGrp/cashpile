import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { getCashflowSnapshot } from "@cashpile/ai";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = Number(req.nextUrl.searchParams.get("horizonDays") ?? 30);
  const horizonDays = Number.isFinite(requested) ? Math.min(90, Math.max(7, Math.round(requested))) : 30;
  const snapshot = await getCashflowSnapshot(user.id, horizonDays);
  return NextResponse.json(snapshot);
}
