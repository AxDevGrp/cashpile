import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { createClient } from "@supabase/supabase-js";
import { backfillPlaidItemTransactions } from "@/lib/plaid-backfill";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const serviceClient = getServiceClient();
    const startDate = body.start_date ?? "2025-01-01";
    const endDate = body.end_date ?? "2025-12-31";

    let items: Array<{ item_id: string; account_ids?: string[] }> = [];

    if (body.account_id) {
      const { data: account } = await serviceClient
        .from("books_financial_accounts")
        .select("plaid_account_id, books_plaid_items!inner(item_id)")
        .eq("id", body.account_id)
        .eq("user_id", user.id)
        .maybeSingle();
      const itemId = (account as any)?.books_plaid_items?.item_id;
      if (!itemId || !(account as any)?.plaid_account_id) {
        return NextResponse.json({ error: "Selected account is not connected to Plaid" }, { status: 400 });
      }
      items = [{ item_id: itemId, account_ids: [(account as any).plaid_account_id] }];
    } else if (body.item_id) {
      const { data: item } = await serviceClient
        .from("books_plaid_items")
        .select("item_id")
        .eq("item_id", body.item_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!item) return NextResponse.json({ error: "Plaid item not found" }, { status: 404 });
      items = [{ item_id: item.item_id }];
    } else {
      const { data } = await serviceClient
        .from("books_plaid_items")
        .select("item_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      items = (data ?? []).map((item: any) => ({ item_id: item.item_id }));
    }

    const results = [];
    for (const item of items) {
      try {
        results.push(await backfillPlaidItemTransactions({
          itemId: item.item_id,
          accountIds: item.account_ids,
          startDate,
          endDate,
          serviceClient,
        }));
      } catch (error: any) {
        results.push({ item_id: item.item_id, error: error?.response?.data ?? error?.message ?? "Backfill failed" });
      }
    }

    return NextResponse.json({ backfilled: results.length, results });
  } catch (err: any) {
    console.error("[plaid/backfill]", err?.response?.data ?? err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Backfill failed" }, { status: 500 });
  }
}
