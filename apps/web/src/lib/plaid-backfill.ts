import { createClient } from "@supabase/supabase-js";
import { syncPlaidItem } from "./plaid-sync.ts";

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

/**
 * Backfill reuses the sync lease and page-write mapper but never advances the
 * sync cursor or claims balances were refreshed. There is no separate private
 * upsert path; the lease is always released.
 */
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

  const { data: item } = await client
    .from("books_plaid_items")
    .select("institution_name")
    .eq("item_id", input.itemId)
    .maybeSingle();

  const result = await syncPlaidItem(input.itemId, client, {
    backfill: true,
    startDate,
    endDate,
    accountIds: input.accountIds,
  });

  return {
    item_id: input.itemId,
    institution: item?.institution_name ?? null,
    start_date: startDate,
    end_date: endDate,
    status: result.status,
    upserted: result.modified,
    tax_assigned: result.tax_assigned ?? 0,
    categorized: 0,
    needs_reconnect_for_more_history: result.modified === 0,
  };
}
