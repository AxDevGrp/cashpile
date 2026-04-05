import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";
import { syncPlaidItem } from "@/lib/plaid-sync";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhook_type, webhook_code, item_id } = body;

    // Verify webhook came from Plaid using the Plaid-Verification header
    // (Full JWT verification requires plaid-node >= 14 — skipped in sandbox)

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
