import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { createClient } from "@supabase/supabase-js";
import { syncPlaidItem } from "@/lib/plaid-sync";

// Service-role client for sync (bypasses RLS — used internally only)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Allow both authenticated users (manual refresh) and internal calls
    const isCron = req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
    const serviceClient = getServiceClient();

    let itemIds: string[];

    if (isCron) {
      // Sync all active items
      const { data: items } = await serviceClient
        .from("books_plaid_items")
        .select("item_id")
        .eq("status", "active");
      itemIds = (items ?? []).map((i: any) => i.item_id);
    } else {
      // Verify user owns this item
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

      const body = await req.json().catch(() => ({}));
      if (body.item_id) {
        // Verify ownership
        const { data: item } = await serviceClient
          .from("books_plaid_items")
          .select("item_id")
          .eq("item_id", body.item_id)
          .eq("user_id", user.id)
          .single();
        if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
        itemIds = [body.item_id];
      } else {
        // Sync all user's items
        const { data: items } = await serviceClient
          .from("books_plaid_items")
          .select("item_id")
          .eq("user_id", user.id)
          .eq("status", "active");
        itemIds = (items ?? []).map((i: any) => i.item_id);
      }
    }

    const results = await Promise.all(itemIds.map((id) =>
      syncPlaidItem(id, serviceClient).catch((err) => {
        console.error(`[plaid/sync] Failed for ${id}:`, err);
        serviceClient
          .from("books_plaid_items")
          .update({ status: "error", error_code: err.message })
          .eq("item_id", id);
        return { error: err.message };
      })
    ));

    return NextResponse.json({ synced: itemIds.length, results });
  } catch (err: any) {
    console.error("[plaid/sync]", err?.response?.data ?? err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
