import { NextRequest } from "next/server";
import { grantSubscriptionCredits, createServiceRoleClient } from "@cashpile/db";
import type { Plan } from "@cashpile/db";

export const runtime = "nodejs";

/**
 * Monthly credit reset cron endpoint.
 *
 * Trigger this on the 1st of each month via Railway / Vercel cron:
 *   Railway:  set a cron service to call POST /api/cron/reset-credits
 *   Vercel:   add to vercel.json: { "crons": [{ "path": "/api/cron/reset-credits", "schedule": "0 0 1 * *" }] }
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 */
export async function POST(req: NextRequest) {
  // ── Auth: verify cron secret ──────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Fetch all active subscriptions ───────────────────────────────────────
  const supabase = createServiceRoleClient();
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("user_id, plan");

  if (error) {
    console.error("[cron/reset-credits] failed to fetch subscriptions:", error.message);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Reset subscription credits for each user ──────────────────────────────
  // Process in batches of 50 to avoid overwhelming the DB
  const BATCH_SIZE = 50;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async ({ user_id, plan }) => {
        try {
          await grantSubscriptionCredits(user_id, plan as Plan, "monthly_cron");
          processed++;
        } catch (err) {
          console.error(`[cron/reset-credits] failed for user ${user_id}:`, err);
          failed++;
        }
      })
    );
  }

  console.log(`[cron/reset-credits] done: ${processed} processed, ${failed} failed`);

  return new Response(JSON.stringify({ processed, failed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
