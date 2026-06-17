"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import { normalizeTransactionDescription } from "../services/duplicate-detection";

type DuplicateTransactionRow = {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  category_id: string | null;
  financial_account_id: string | null;
  import_source: string | null;
  plaid_transaction_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  books_categories?: { name: string } | null;
  books_financial_accounts?: { name: string } | null;
};

export type DuplicateReviewGroup = {
  id: string;
  reason: "exact" | "possible";
  confidence?: number;
  transactions: DuplicateTransactionRow[];
};

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function amountKey(amount: number) {
  return Number(amount).toFixed(2);
}

function exactGroupKey(tx: DuplicateTransactionRow) {
  return [
    tx.financial_account_id ?? "unknown",
    tx.date,
    amountKey(tx.amount),
    normalizeTransactionDescription(tx.description),
  ].join("|");
}

function isReviewed(tx: DuplicateTransactionRow) {
  return tx.metadata?.duplicate_reviewed === true;
}

function sortBestKeeperFirst(rows: DuplicateTransactionRow[]) {
  return [...rows].sort((a, b) => {
    const score = (tx: DuplicateTransactionRow) =>
      (tx.financial_account_id ? 4 : 0) +
      (tx.category_id ? 2 : 0) +
      (tx.merchant ? 1 : 0) +
      (tx.plaid_transaction_id ? 1 : 0);
    const scoreDiff = score(b) - score(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.created_at.localeCompare(b.created_at);
  });
}

function possibleGroupConfidence(rows: DuplicateTransactionRow[]) {
  const confidences = rows
    .map((tx) => tx.metadata?.duplicate_confidence)
    .filter((confidence): confidence is number => typeof confidence === "number");
  return confidences.length > 0 ? Math.max(...confidences) : undefined;
}

async function getCurrentUserSupabase() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return { supabase, user };
}

export async function listDuplicateReviewGroups(): Promise<DuplicateReviewGroup[]> {
  const { supabase, user } = await getCurrentUserSupabase();

  const rows: DuplicateTransactionRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .from("books_transactions")
      .select("id, date, description, merchant, amount, category_id, financial_account_id, import_source, plaid_transaction_id, metadata, created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as DuplicateTransactionRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }

  const transactions = rows.filter((tx) => !isReviewed(tx));

  const categoryIds = Array.from(new Set(transactions.map((tx) => tx.category_id).filter(Boolean)));
  const accountIds = Array.from(new Set(transactions.map((tx) => tx.financial_account_id).filter(Boolean)));

  const [categoriesRes, accountsRes] = await Promise.all([
    categoryIds.length > 0
      ? (supabase as any).from("books_categories").select("id, name").eq("user_id", user.id).in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
    accountIds.length > 0
      ? (supabase as any).from("books_financial_accounts").select("id, name").eq("user_id", user.id).in("id", accountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (categoriesRes.error) throw new Error(categoriesRes.error.message);
  if (accountsRes.error) throw new Error(accountsRes.error.message);

  const categoriesById = new Map<string, { name: string }>((categoriesRes.data ?? []).map((category: any) => [String(category.id), { name: category.name }]));
  const accountsById = new Map<string, { name: string }>((accountsRes.data ?? []).map((account: any) => [String(account.id), { name: account.name }]));

  const hydrated: DuplicateTransactionRow[] = transactions.map((tx) => ({
    ...tx,
    books_categories: tx.category_id ? categoriesById.get(String(tx.category_id)) ?? null : null,
    books_financial_accounts: tx.financial_account_id ? accountsById.get(String(tx.financial_account_id)) ?? null : null,
  }));

  const exactRowsByKey = new Map<string, DuplicateTransactionRow[]>();
  for (const tx of hydrated) {
    const key = exactGroupKey(tx);
    exactRowsByKey.set(key, [...(exactRowsByKey.get(key) ?? []), tx]);
  }

  const byId = new Map(hydrated.map((tx) => [tx.id, tx]));
  const links = new Map<string, Set<string>>();
  const linkIds = new Set<string>();
  const exactLinkIds = new Set<string>();
  const addLink = (a: string, b: string, reason: "exact" | "possible") => {
    links.set(a, (links.get(a) ?? new Set()).add(b));
    links.set(b, (links.get(b) ?? new Set()).add(a));
    linkIds.add(a);
    linkIds.add(b);
    if (reason === "exact") {
      exactLinkIds.add(a);
      exactLinkIds.add(b);
    }
  };

  for (const groupRows of exactRowsByKey.values()) {
    if (groupRows.length < 2) continue;
    const [first, ...rest] = groupRows;
    for (const tx of rest) addLink(first.id, tx.id, "exact");
  }

  for (const tx of hydrated) {
    const candidateId = tx.metadata?.duplicate_candidate_id;
    if (!candidateId) continue;
    const candidate = byId.get(candidateId);
    if (!candidate || isReviewed(candidate)) continue;
    addLink(tx.id, candidateId, "possible");
  }

  const reviewGroups: DuplicateReviewGroup[] = [];
  const visited = new Set<string>();
  for (const id of linkIds) {
    if (visited.has(id)) continue;
    const componentIds: string[] = [];
    const queue = [id];
    visited.add(id);

    for (let index = 0; index < queue.length; index++) {
      const currentId = queue[index];
      componentIds.push(currentId);
      for (const linkedId of links.get(currentId) ?? []) {
        if (visited.has(linkedId)) continue;
        visited.add(linkedId);
        queue.push(linkedId);
      }
    }

    const sorted = sortBestKeeperFirst(componentIds.map((componentId) => byId.get(componentId)).filter(Boolean) as DuplicateTransactionRow[]);
    if (sorted.length < 2) continue;
    const reason = componentIds.some((componentId) => exactLinkIds.has(componentId)) ? "exact" : "possible";
    reviewGroups.push({
      id: `${reason}:${componentIds.sort().join(":")}`,
      reason,
      confidence: reason === "possible" ? possibleGroupConfidence(sorted) : undefined,
      transactions: sorted,
    });
  }

  return reviewGroups.sort((a, b) => b.transactions[0].date.localeCompare(a.transactions[0].date));
}

export async function deleteDuplicateTransactions(transactionIds: string[]) {
  if (transactionIds.length === 0) return { deleted: 0 };
  const { supabase, user } = await getCurrentUserSupabase();
  const { error } = await (supabase as any)
    .from("books_transactions")
    .delete()
    .eq("user_id", user.id)
    .in("id", transactionIds);
  if (error) throw new Error(error.message);
  revalidatePath("/books/transactions");
  revalidatePath("/books/transactions/duplicates");
  return { deleted: transactionIds.length };
}

export async function mergeDuplicateTransactions(keeperId: string, duplicateIds: string[]) {
  if (!keeperId) throw new Error("Keeper transaction is required");
  const ids = duplicateIds.filter((id) => id !== keeperId);
  if (ids.length === 0) return { merged: 0 };

  const { supabase, user } = await getCurrentUserSupabase();
  const result = await mergeDuplicateTransactionsForUser(supabase, user.id, keeperId, ids);
  revalidatePath("/books/transactions");
  revalidatePath("/books/transactions/duplicates");
  return result;
}

async function mergeDuplicateTransactionsForUser(
  supabase: SupabaseClient,
  userId: string,
  keeperId: string,
  ids: string[]
) {
  const { data: rows, error: loadError } = await (supabase as any)
    .from("books_transactions")
    .select("id, merchant, category_id, financial_account_id, metadata")
    .eq("user_id", userId)
    .in("id", [keeperId, ...ids]);
  if (loadError) throw new Error(loadError.message);

  const keeper = (rows ?? []).find((tx: any) => tx.id === keeperId);
  if (!keeper) throw new Error("Keeper transaction not found");

  const duplicates = (rows ?? []).filter((tx: any) => ids.includes(tx.id));
  const update: Record<string, any> = {
    metadata: {
      ...(keeper.metadata ?? {}),
      duplicate_reviewed: true,
      merged_duplicate_ids: ids,
    },
    updated_at: new Date().toISOString(),
  };

  const accountSource = duplicates.find((tx: any) => tx.financial_account_id);
  const categorySource = duplicates.find((tx: any) => tx.category_id);
  const merchantSource = duplicates.find((tx: any) => tx.merchant);
  if (!keeper.financial_account_id && accountSource?.financial_account_id) update.financial_account_id = accountSource.financial_account_id;
  if (!keeper.category_id && categorySource?.category_id) update.category_id = categorySource.category_id;
  if (!keeper.merchant && merchantSource?.merchant) update.merchant = merchantSource.merchant;

  const { error: updateError } = await (supabase as any)
    .from("books_transactions")
    .update(update)
    .eq("user_id", userId)
    .eq("id", keeperId);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await (supabase as any)
    .from("books_transactions")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
  if (deleteError) throw new Error(deleteError.message);

  return { merged: ids.length };
}

export async function markDuplicateGroupReviewed(transactionIds: string[]) {
  if (transactionIds.length === 0) return { reviewed: 0 };
  const { supabase, user } = await getCurrentUserSupabase();
  const { data: rows, error: loadError } = await (supabase as any)
    .from("books_transactions")
    .select("id, metadata")
    .eq("user_id", user.id)
    .in("id", transactionIds);
  if (loadError) throw new Error(loadError.message);

  for (const row of rows ?? []) {
    const { error } = await (supabase as any)
      .from("books_transactions")
      .update({
        metadata: { ...(row.metadata ?? {}), duplicate_reviewed: true },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/books/transactions/duplicates");
  return { reviewed: rows?.length ?? 0 };
}

export async function bulkMergeDuplicateGroups(groups: { keeperId: string; duplicateIds: string[] }[]) {
  let merged = 0;
  const { supabase, user } = await getCurrentUserSupabase();

  for (const group of groups) {
    const ids = group.duplicateIds.filter((id) => id !== group.keeperId);
    if (group.keeperId && ids.length > 0) {
      const result = await mergeDuplicateTransactionsForUser(supabase, user.id, group.keeperId, ids);
      merged += result.merged;
    }
  }

  revalidatePath("/books/transactions");
  revalidatePath("/books/transactions/duplicates");
  return { merged };
}

export async function bulkMarkDuplicateGroupsReviewed(transactionIds: string[]) {
  return markDuplicateGroupReviewed(Array.from(new Set(transactionIds)));
}
