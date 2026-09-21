import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";
import { syncPlaidItem } from "@/lib/plaid-sync";
import { verifyPlaidWebhook } from "@/lib/plaid-webhook-verification";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (process.env.PLAID_SKIP_WEBHOOK_VERIFICATION !== "true") {
      const verification = await verifyPlaidWebhook({
        verificationHeader: req.headers.get("plaid-verification"),
        rawBody,
      });
      if (!verification.valid) {
        return NextResponse.json({ error: verification.reason ?? "invalid webhook" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    const { webhook_type, webhook_code, item_id } = body;

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    if (webhook_type === "TRANSACTIONS") {
      if (
        webhook_code === "SYNC_UPDATES_AVAILABLE" ||
        webhook_code === "DEFAULT_UPDATE" ||
        webhook_code === "INITIAL_UPDATE"
      ) {
        await syncPlaidItem(item_id, serviceClient);
      }
    }

    if (webhook_type === "ITEM") {
      if (webhook_code === "ERROR") {
        await serviceClient
          .from("books_plaid_items")
          .update({ status: "error", error_code: body.error?.error_code ?? "UNKNOWN" })
          .eq("item_id", item_id);
      }
      if (webhook_code === "PENDING_EXPIRATION" || webhook_code === "USER_PERMISSION_REVOKED") {
        await serviceClient
          .from("books_plaid_items")
          .update({ status: "disconnected" })
          .eq("item_id", item_id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[plaid/webhook]", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
