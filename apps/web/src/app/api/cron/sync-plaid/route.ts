import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncPlaidItem } from "@/lib/plaid-sync";

export async function GET(req: NextRequest) {
  // Protect with cron secret
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: items, error } = await serviceClient
    .from("books_plaid_items")
    .select("item_id")
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const item of items ?? []) {
    try {
      const result = await syncPlaidItem(item.item_id, serviceClient);
      results.push({ item_id: item.item_id, ...result });
    } catch (err: any) {
      results.push({ item_id: item.item_id, error: err.message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
