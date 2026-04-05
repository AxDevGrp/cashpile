import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";

// Service-role client for sync (bypasses RLS — used internally only)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function syncPlaidItem(itemId: string, serviceClient?: any) {
  const client = serviceClient ?? getServiceClient();

  // Fetch item from DB
  const { data: item, error } = await client
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
    const { data: accounts } = await client
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
      await client
        .from("books_transactions")
        .upsert(toUpsert, { onConflict: "import_source,metadata->plaid_transaction_id", ignoreDuplicates: false })
        .catch(() => {
          // Fallback: insert one by one if upsert on jsonb key fails
          return Promise.all(toUpsert.map((tx) =>
            client.from("books_transactions").upsert(tx, { ignoreDuplicates: true })
          ));
        });
    }

    // Remove deleted transactions
    for (const t of removedTxns) {
      await client
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
    const accountId = (await client
      .from("books_financial_accounts")
      .select("id")
      .eq("plaid_account_id", acct.account_id)
      .single())?.data?.id;
    if (accountId) {
      await client
        .from("books_financial_accounts")
        .update({ current_balance: acct.balances.current ?? 0, updated_at: new Date().toISOString() })
        .eq("id", accountId);
    }
  }

  // Save updated cursor and last_synced_at
  await client
    .from("books_plaid_items")
    .update({ cursor, last_synced_at: new Date().toISOString(), status: "active", error_code: null })
    .eq("item_id", itemId);

  return { added, modified, removed };
}
