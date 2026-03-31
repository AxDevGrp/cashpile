import { NextRequest } from "next/server";
import Stripe from "stripe";
import { grantTopupCredits, grantSubscriptionCredits, createServiceRoleClient } from "@cashpile/db";
import type { Plan } from "@cashpile/db";

export const runtime = "nodejs";

// Stripe plan nicknames / price metadata must include "cashpile_plan" key
// mapping to one of: free | books | trades | pulse | pro
const STRIPE_PLAN_META_KEY = "cashpile_plan";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe-webhook] signature verification failed:", message);
    return new Response(`Webhook signature error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── One-time topup completed ─────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type !== "ai_topup") break;

        const userId = session.metadata?.userId;
        const creditAmount = parseInt(session.metadata?.creditAmount ?? "0", 10);

        if (!userId || !creditAmount) {
          console.error("[stripe-webhook] missing metadata on checkout.session.completed");
          break;
        }

        await grantTopupCredits(userId, creditAmount, {
          stripeSessionId: session.id,
          amountPaid: session.amount_total,
        });

        console.log(`[stripe-webhook] granted ${creditAmount} topup credits to ${userId}`);
        break;
      }

      // ── Subscription renewal — reset monthly credits ──────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        // Only handle subscription invoices (not one-time)
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        // Look up the user by stripe_customer_id
        const supabase = createServiceRoleClient();
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_customer_id", invoice.customer as string)
          .single();

        if (!sub) {
          console.warn("[stripe-webhook] no user found for customer:", invoice.customer);
          break;
        }

        // Determine plan from subscription price metadata or existing record
        const planMeta = subscription.items.data[0]?.price?.metadata?.[STRIPE_PLAN_META_KEY];
        const plan = (planMeta as Plan | undefined) ?? (sub.plan as Plan);

        await grantSubscriptionCredits(sub.user_id, plan, "invoice_paid");

        console.log(`[stripe-webhook] reset subscription credits for ${sub.user_id} on plan ${plan}`);
        break;
      }

      default:
        // Unhandled event — not an error
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response("Internal server error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
