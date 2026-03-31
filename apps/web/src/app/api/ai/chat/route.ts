import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { askCash } from "@cashpile/ai";
import type { CoreMessage } from "ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Auth check
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

  let messages: CoreMessage[];
  try {
    const body = await req.json();
    messages = body.messages ?? [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = askCash(user.id, messages);
  return result.toDataStreamResponse();
}
