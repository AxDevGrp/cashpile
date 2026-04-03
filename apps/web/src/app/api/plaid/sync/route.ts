import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { plaidClient } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

// Service-role client for sync (bypasses RLS — used internally only)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function syncPlaidItem(itemId: string, serviceClient: any) {
  // Fetch item from DB
  const { data: item, error } = await serviceClient
    .from("books_plaid_items")
    .select("*")
    .eq("item_id", itemId)
    .single();
  if (error || !item) throw new Error(`Item not found: ${itemId}`);

  const { access_token, cursor: storedCursor, user_id } = item;
  let cursor = storedCursor ?? undefined;
  let hasMore = true;
  let added = 0, modified = 0, removed = 0;

  while (hasMore) {
    const res = await plaidClient.transactionsSync({
      access_token,
      cursor,
      options: { include_personal_finance_category: true },
    });
    const { added: newTxns, modified: modTxns, removed: removedTxns, next_cursor, has_more } = res.data;

    // Resolve plaid_account_id → cashpile financial_account id
    const { data: accounts } = await serviceClient
      .from("books_financial_accounts")
      .select("id, plaid_account_id")
      .eq("plaid_item_id", item.id);

    const accountMap = new Map((accounts ?? []).map((a: any) => [a.plaid_account_id, a.id]));

    // Upsert added + modified transactions
    const toUpsert = [...newTxns, ...modTxns].map((t) => ({
      user_id,
      financial_account_id: accountMap.get(t.account_id) ?? null,
      description:          t.name,
      merchant:             t.merchant_name ?? null,
      amount:               -t.amount, // Plaid: positive = debit; Cashpile: positive = credit
      date:                 t.date,
      transaction_type:     t.amount > 0 ? "debit" : "credit",
      import_source:        "plaid",
      import_batch_id:      null,
      metadata:             { plaid_transaction_id: t.transaction_id, category: t.personal_finance_category?.primary },
    }));

    if (toUpsert.length > 0) {
      await serviceClient
        .from("books_transactions")
        .upsert(toUpsert, { onConflict: "import_source,metadata->plaid_transaction_id", ignoreDuplicates: false })
        .catch(() => {
          // Fallback: insert one by one if upsert on jsonb key fails
          return Promise.all(toUpsert.map((tx) =>
            serviceClient.from("books_transactions").upsert(tx, { ignoreDuplicates: true })
          ));
        });
    }

    // Remove deleted transactions
    for (const t of removedTxns) {
      await serviceClient
        .from("books_transactions")
        .delete()
        .contains("metadata", { plaid_transaction_id: t.transaction_id });
    }

    added    += newTxns.length;
    modified += modTxns.length;
    removed  += removedTxns.length;
    cursor    = next_cursor;
    hasMore   = has_more;
  }

  // Update account balances
  const balancesRes = await plaidClient.accountsGet({ access_token });
  for (const acct of balancesRes.data.accounts) {
    const accountId = (await serviceClient
      .from("books_financial_accounts")
      .select("id")
      .eq("plaid_account_id", acct.account_id)
      .single())?.data?.id;
    if (accountId) {
      await serviceClient
        .from("books_financial_accounts")
        .update({ current_balance: acct.balances.current ?? 0, updated_at: new Date().toISOString() })
        .eq("id", accountId);
    }
  }

  // Save updated cursor and last_synced_at
  await serviceClient
    .from("books_plaid_items")
    .update({ cursor, last_synced_at: new Date().toISOString(), status: "active", error_code: null })
    .eq("item_id", itemId);

  return { added, modified, removed };
}

// ── Route handler ────────────────────────────────────────────────────────────

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
