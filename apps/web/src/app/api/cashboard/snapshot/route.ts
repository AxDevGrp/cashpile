import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { getCashboardSnapshot } from "@cashpile/ai";
import { handleCashboardSnapshot } from "@/lib/cashboard-api";

// Session-authenticated GET. No userId input; private, no-store.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await handleCashboardSnapshot({
    getUserId: async () => user?.id ?? null,
    loadSnapshot: (userId) => getCashboardSnapshot(userId),
  });

  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}
