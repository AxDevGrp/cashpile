import { NextRequest } from "next/server";
import { createServerSupabaseClient, getUserCreditBalance, deductCredits } from "@cashpile/db";
import { askCash, calculateCreditCost } from "@cashpile/ai";
import type { CoreMessage } from "ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // ── Credit guard ──────────────────────────────────────────────────────────
  const balance = await getUserCreditBalance(user.id);
  if (balance.total <= 0) {
    return new Response(
      JSON.stringify({
        error: "insufficient_credits",
        message: "You have no AI credits remaining. Top up to continue.",
        balance: 0,
      }),
      {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
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

  // ── Stream + deduct on finish ─────────────────────────────────────────────
  const result = askCash(user.id, messages, {
    onFinish: ({ usage }) => {
      // Fire-and-forget — don't block the stream response
      const cost = calculateCreditCost({
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      });
      deductCredits(user.id, cost, {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      }).catch((err) => {
        console.error("[credits] post-stream deduction failed:", err);
      });
    },
  });

  return result.toDataStreamResponse();
}
