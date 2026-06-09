import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";
import { autoAssignTaxEntities } from "@/modules/books/services/tax-rule-engine";
import { categorizeTransactionsByIds } from "@/modules/books/services/categorization-engine";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function clampDate(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

async function upsertPlaidTransactions(client: any, item: any, transactions: any[]) {
  const { data: accounts } = await client
    .from("books_financial_accounts")
    .select("id, plaid_account_id")
    .eq("plaid_item_id", item.id);

  const accountMap = new Map((accounts ?? []).map((account: any) => [account.plaid_account_id, account.id]));
  const importOptions = item.import_options ?? {};

  let rows = transactions.map((transaction) => ({
    user_id: item.user_id,
    financial_account_id: accountMap.get(transaction.account_id) ?? null,
    description: transaction.name,
    merchant: transaction.merchant_name ?? null,
    amount: -transaction.amount,
    date: transaction.date,
    transaction_type: transaction.amount > 0 ? "debit" : "credit",
    plaid_transaction_id: transaction.transaction_id,
    dedupe_fingerprint: null,
    import_source: "plaid",
    import_batch_id: null,
    metadata: {
      plaid_transaction_id: transaction.transaction_id,
      plaid_account_id: transaction.account_id,
      pending: transaction.pending,
      category: transaction.personal_finance_category?.primary,
      detailed_category: transaction.personal_finance_category?.detailed,
      duplicate_mode: importOptions.duplicate_mode ?? "flag_review",
      historical_backfill: true,
    },
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return { upserted: 0, assigned: 0 };

  if (importOptions.duplicate_mode !== "keep_all") {
    const dates = rows.map((row) => row.date).sort();
    const { data: existingTransactions } = await client
      .from("books_transactions")
      .select("financial_account_id, date, amount")
      .eq("user_id", item.user_id)
      .is("plaid_transaction_id", null)
      .gte("date", dates[0])
      .lte("date", dates[dates.length - 1]);

    const existingKeys = new Set(
      (existingTransactions ?? []).map((tx: any) => `${tx.financial_account_id ?? "unknown"}|${tx.date}|${Number(tx.amount).toFixed(2)}`)
    );

    rows = rows.map((row) => ({
      ...row,
      metadata: {
        ...row.metadata,
        possible_duplicate: existingKeys.has(`${row.financial_account_id ?? "unknown"}|${row.date}|${Number(row.amount).toFixed(2)}`),
      },
    }));
  }

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await client
      .from("books_transactions")
      .upsert(batch, { onConflict: "user_id,plaid_transaction_id", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }

  const accountIds = Array.from(new Set(rows.map((row) => row.financial_account_id).filter(Boolean)));
  const { data: importedRows } = await client
    .from("books_transactions")
    .select("id, description, merchant, amount, date, category_id, financial_account_id")
    .eq("user_id", item.user_id)
    .in("plaid_transaction_id", rows.map((row) => row.plaid_transaction_id));

  let assigned = 0;
  let categorized = 0;
  if (importedRows?.length) {
    assigned = await autoAssignTaxEntities(client, item.user_id, importedRows);
    const categorization = await categorizeTransactionsByIds(
      client,
      item.user_id,
      importedRows.map((row: any) => row.id),
      { useAI: true, minConfidence: 0.85 }
    );
    categorized = categorization.categorized;
  }

  return { upserted: rows.length, assigned, categorized, accountIds };
}

export async function backfillPlaidItemTransactions(input: {
  itemId: string;
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  serviceClient?: any;
}) {
  const client = input.serviceClient ?? getServiceClient();
  const startDate = clampDate(input.startDate, "2025-01-01");
  const endDate = clampDate(input.endDate, "2025-12-31");

  const { data: item, error } = await client
    .from("books_plaid_items")
    .select("*")
    .eq("item_id", input.itemId)
    .single();
  if (error || !item) throw new Error(`Item not found: ${input.itemId}`);

  const count = 500;
  let offset = 0;
  let totalTransactions = 0;
  let fetched = 0;
  let upserted = 0;
  let assigned = 0;
  let categorized = 0;

  do {
    const response = await plaidClient.transactionsGet({
      access_token: item.access_token,
      start_date: startDate,
      end_date: endDate,
      options: {
        account_ids: input.accountIds,
        count,
        offset,
        include_personal_finance_category: true,
      },
    } as any);

    const transactions = response.data.transactions ?? [];
    totalTransactions = response.data.total_transactions ?? transactions.length;
    fetched += transactions.length;

    const result = await upsertPlaidTransactions(client, item, transactions);
    upserted += result.upserted;
    assigned += result.assigned;
    categorized += result.categorized ?? 0;

    offset += transactions.length;
    if (transactions.length === 0) break;
  } while (offset < totalTransactions);

  await client
    .from("books_plaid_items")
    .update({
      import_options: {
        ...(item.import_options ?? {}),
        historical_backfill: { start_date: startDate, end_date: endDate, last_run_at: new Date().toISOString() },
      },
      last_synced_at: new Date().toISOString(),
      status: "active",
      error_code: null,
    })
    .eq("item_id", input.itemId);

  return {
    item_id: input.itemId,
    institution: item.institution_name,
    start_date: startDate,
    end_date: endDate,
    plaid_returned: fetched,
    total_available: totalTransactions,
    upserted,
    tax_assigned: assigned,
    categorized,
    needs_reconnect_for_more_history: fetched === 0,
  };
}
