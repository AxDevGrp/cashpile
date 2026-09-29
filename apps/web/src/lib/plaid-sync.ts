import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";
import { autoAssignTaxEntities } from "@/modules/books/services/tax-rule-engine";
import { normalizePlaidBalance, normalizePlaidTransaction } from "./plaid-ingestion.ts";

// Service-role client for sync (bypasses RLS — used internally only)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface PlaidSyncOptions {
  /** Backfill reuses the same lease/page mapper but never advances the cursor. */
  backfill?: boolean;
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
}

type PlaidSyncResult = {
  item_id: string;
  status: "synced" | "busy" | "retryable_failure";
  added: number;
  modified: number;
  removed: number;
  tax_assigned?: number;
};

function isMutationDuringPagination(err: any): boolean {
  return err?.response?.data?.error_code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";
}

async function loadAccountMap(client: any, itemId: string): Promise<Map<string, string>> {
  const { data: accounts } = await client
    .from("books_financial_accounts")
    .select("id, plaid_account_id")
    .eq("plaid_item_id", itemId);
  return new Map((accounts ?? []).map((a: any) => [a.plaid_account_id, a.id]));
}

async function assignTaxForChangedRows(client: any, userId: string, transactionIds: string[]): Promise<number> {
  if (transactionIds.length === 0) return 0;
  const { data: rows } = await client
    .from("books_transactions")
    .select("id, description, merchant, amount, date, category_id, financial_account_id")
    .eq("user_id", userId)
    .in("id", transactionIds);
  if (!rows?.length) return 0;
  return autoAssignTaxEntities(client, userId, rows);
}

export async function syncPlaidItem(
  itemId: string,
  serviceClient?: any,
  options: PlaidSyncOptions = {}
): Promise<PlaidSyncResult> {
  const client = serviceClient ?? getServiceClient();
  const token = randomUUID();
  const isBackfill = options.backfill === true;

  const claim = await client.rpc("consumer_claim_sync", { p_item_id: itemId, p_token: token });
  if (claim.error) throw new Error(claim.error.message);
  if (!claim.data) {
    return { item_id: itemId, status: "busy", added: 0, modified: 0, removed: 0 };
  }

  try {
    const { data: item, error } = await client
      .from("books_plaid_items")
      .select("*")
      .eq("item_id", itemId)
      .single();
    if (error || !item) throw new Error(`Item not found: ${itemId}`);

    const { access_token, user_id } = item;
    const accountMap = await loadAccountMap(client, item.id);
    const initialCursor: string | undefined = item.cursor ?? undefined;

    let cursor = initialCursor;
    let restarts = 0;
    let added = 0;
    let modified = 0;
    let removed = 0;
    const changedIds: string[] = [];
    const removedIds: string[] = [];
    let nextCursor: string | null = item.cursor ?? null;

    if (isBackfill) {
      const startDate = options.startDate ?? "2025-01-01";
      const endDate = options.endDate ?? "2025-12-31";
      const count = 500;
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      const pageOptions: Record<string, unknown> = {
        count,
        offset,
        include_personal_finance_category: true,
      };
      if (options.accountIds) pageOptions.account_ids = options.accountIds;

      while (offset < total) {
        const response = await plaidClient.transactionsGet({
          access_token,
          start_date: startDate,
          end_date: endDate,
          options: { ...pageOptions, offset } as any,
        } as any);
        const transactions = response.data.transactions ?? [];
        total = response.data.total_transactions ?? transactions.length;
        const rows = transactions.map((t) =>
          normalizePlaidTransaction(t, accountMap.get(t.account_id))
        );
        if (rows.length > 0) {
          const write = await client.rpc("consumer_write_plaid_page", {
            p_item_id: itemId,
            p_token: token,
            p_rows: rows,
          });
          if (write.error) throw new Error(write.error.message);
          changedIds.push(...(write.data ?? []));
          modified += rows.length;
        }
        offset += transactions.length;
        if (transactions.length === 0) break;
      }
    } else {
      let hasMore = true;
      while (hasMore) {
        let res;
        try {
          res = await plaidClient.transactionsSync({
            access_token,
            cursor,
            options: { include_personal_finance_category: true },
          });
        } catch (err) {
          if (isMutationDuringPagination(err)) {
            if (restarts >= 2) {
              return { item_id: itemId, status: "retryable_failure", added, modified, removed };
            }
            restarts += 1;
            cursor = initialCursor;
            continue;
          }
          throw err;
        }

        const {
          added: newTxns,
          modified: modTxns,
          removed: removedTxns,
          next_cursor,
          has_more,
        } = res.data;

        const rows = [...newTxns, ...modTxns].map((t) =>
          normalizePlaidTransaction(t, accountMap.get(t.account_id))
        );

        if (rows.length > 0) {
          const write = await client.rpc("consumer_write_plaid_page", {
            p_item_id: itemId,
            p_token: token,
            p_rows: rows,
          });
          if (write.error) throw new Error(write.error.message);
          changedIds.push(...(write.data ?? []));
        }

        for (const t of removedTxns) removedIds.push(t.transaction_id);
        added += newTxns.length;
        modified += modTxns.length;
        removed += removedTxns.length;
        cursor = next_cursor;
        nextCursor = next_cursor;
        hasMore = has_more;
      }
    }

    // Balances only accompany the normal sync finalization; balances are not
    // claimed refreshed by a backfill.
    let balances: any[] = [];
    if (!isBackfill) {
      const balancesRes = await plaidClient.accountsGet({ access_token });
      const asOf = new Date().toISOString();
      balances = balancesRes.data.accounts
        .map((acct) => {
          const accountId = accountMap.get(acct.account_id);
          if (!accountId) return null;
          const normalized = normalizePlaidBalance(acct.balances);
          return { account_id: accountId, ...normalized, balance_as_of: asOf };
        })
        .filter(Boolean);
    }

    const finish = await client.rpc("consumer_finish_sync", {
      p_item_id: itemId,
      p_token: token,
      p_removed_ids: removedIds,
      p_balances: balances,
      p_next_cursor: isBackfill ? item.cursor : nextCursor,
    });
    if (finish.error) throw new Error(finish.error.message);

    const taxAssigned = await assignTaxForChangedRows(client, user_id, changedIds);

    return {
      item_id: itemId,
      status: "synced",
      added,
      modified,
      removed,
      tax_assigned: taxAssigned,
    };
  } finally {
    await client.rpc("consumer_release_sync", { p_item_id: itemId, p_token: token });
  }
}
