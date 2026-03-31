import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@cashpile/db";
import { TOPUP_CREDIT_AMOUNTS } from "@cashpile/db";

export const runtime = "nodejs";

const VALID_AMOUNTS = [5, 10, 25] as const;
type TopupAmount = (typeof VALID_AMOUNTS)[number];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

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

  // ── Parse body ────────────────────────────────────────────────────────────
  let amount: TopupAmount;
  try {
    const body = await req.json();
    if (!VALID_AMOUNTS.includes(body.amount)) {
      return new Response(
        JSON.stringify({ error: "Invalid amount. Must be 5, 10, or 25." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    amount = body.amount as TopupAmount;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const creditAmount = TOPUP_CREDIT_AMOUNTS[amount];
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Create Stripe Checkout Session ────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount * 100, // cents
          product_data: {
            name: `Cashpile AI Credits — $${amount} topup`,
            description: `${creditAmount.toLocaleString()} AI credits added to your account`,
          },
        },
      },
    ],
    metadata: {
      userId: user.id,
      creditAmount: String(creditAmount),
      type: "ai_topup",
    },
    customer_email: user.email,
    success_url: `${origin}/settings?topup=success`,
    cancel_url: `${origin}/settings?topup=cancelled`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
