import { NextRequest } from "next/server";
import { createServerSupabaseClient, getUserCreditBalance } from "@cashpile/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const balance = await getUserCreditBalance(user.id);

  return new Response(JSON.stringify(balance), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
