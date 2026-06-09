"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@cashpile/ui";
import { Button } from "@cashpile/ui";
import { Badge } from "@cashpile/ui";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@cashpile/ui";
import { formatCurrency, formatDate } from "@cashpile/ui";
import type { BooksTransaction, TaxEntity, BooksCategory, BooksUda } from "@/modules/books/types";

interface Props {
  transactions: (BooksTransaction & { 
    books_categories?: { name: string } | null; 
    books_financial_accounts?: { name: string } | null;
    books_tax_transaction_views?: Array<{ tax_entity_id: string; tax_notes: string | null; business_percentage: number }>;
  })[];
  totalCount: number;
  entities: TaxEntity[];
  categories: BooksCategory[];
  udas: (BooksUda & { books_financial_accounts?: { id: string; name: string }[] })[];
  accounts?: { id: string; name: string; institution_name?: string | null; institution?: string | null; last_four_digits?: string | null }[];
  filters: { udaId?: string; accountId?: string; categoryId?: string; from?: string; to?: string; search?: string };
  loadError?: string;
  title?: string;
  description?: string;
  descriptionContext?: string;
  backHref?: string;
  lockedAccountId?: string;
  requireQuery?: boolean;
  emptyQueryMessage?: string;
}

export default function TransactionsClient({
  transactions,
  totalCount,
  entities,
  categories,
  udas,
  accounts = [],
  filters,
  loadError,
  title = "Transactions",
  description,
  descriptionContext,
  backHref,
  lockedAccountId,
  requireQuery = false,
  emptyQueryMessage = "Search or filter transactions to see results.",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(transactions);
  const [count, setCount] = useState(totalCount);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [isLoading, setIsLoading] = useState(!requireQuery);
  const [clientError, setClientError] = useState<string | undefined>(loadError);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [categorizeMode, setCategorizeMode] = useState<"rules" | "ai" | null>(null);
  const [categorizeSummary, setCategorizeSummary] = useState<string | null>(null);
  const [backfillSummary, setBackfillSummary] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillYear, setBackfillYear] = useState("2025");
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  const selectedYear = filters.from?.match(/^\d{4}-01-01$/) && filters.to === `${filters.from.slice(0, 4)}-12-31`
    ? filters.from.slice(0, 4)
    : filters.from || filters.to
      ? "custom"
      : "all";
  const hasActiveQuery = Boolean(
    filters.search?.trim() ||
    filters.accountId ||
    filters.udaId ||
    filters.categoryId ||
    filters.from ||
    filters.to ||
    lockedAccountId
  );
  const shouldLoadTransactions = !requireQuery || hasActiveQuery;
  const pageSize = 100;
  const currentOffset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const visibleStart = count === 0 ? 0 : currentOffset + 1;
  const visibleEnd = Math.min(currentOffset + rows.length, count);
  const headerDescription = !shouldLoadTransactions
    ? description ?? emptyQueryMessage
    : isLoading
      ? "Loading transactions…"
      : descriptionContext
        ? `${count} transactions ${descriptionContext}`
        : description ?? `${count} transactions`;
  function accountOptionLabel(account: NonNullable<Props["accounts"]>[number]) {
    const institution = account.institution_name ?? account.institution;
    return `${account.name}${institution ? ` · ${institution}` : ""}${account.last_four_digits ? ` - *${account.last_four_digits}` : ""}`;
  }

  useEffect(() => {
    let cancelled = false;
    async function loadTransactions() {
      if (!shouldLoadTransactions) {
        setRows([]);
        setCount(0);
        setClientError(undefined);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setClientError(undefined);
      try {
        const params = new URLSearchParams(searchParams.toString());
        if (filters.accountId && !params.has("accountId")) params.set("accountId", filters.accountId);
        if (filters.udaId && !params.has("udaId")) params.set("udaId", filters.udaId);
        if (filters.categoryId && !params.has("categoryId")) params.set("categoryId", filters.categoryId);
        if (filters.from && !params.has("from")) params.set("from", filters.from);
        if (filters.to && !params.has("to")) params.set("to", filters.to);
        if (filters.search && !params.has("search")) params.set("search", filters.search);
        params.set("limit", String(pageSize));
        const res = await fetch(`/api/books/transactions?${params.toString()}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Unable to load transactions");
        }
        if (!cancelled) {
          setRows(data.transactions ?? []);
          setCount(data.count ?? 0);
          setCategoryOptions(data.categories ?? []);
        }
      } catch (error) {
        console.error("[books/transactions] client load failed:", error);
        if (!cancelled) {
          setRows([]);
          setCount(0);
          setClientError(error instanceof Error ? error.message : "Unable to load transactions");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [filters.accountId, filters.categoryId, filters.from, filters.search, filters.to, filters.udaId, searchParams, shouldLoadTransactions]);

  useEffect(() => {
    setSearchDraft(filters.search ?? "");
  }, [filters.search]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("offset");
    if (lockedAccountId) params.set("accountId", lockedAccountId);
    const basePath = lockedAccountId ? `/books/accounts/${lockedAccountId}/transactions` : "/books/transactions";
    router.push(`${basePath}?${params.toString()}`);
  }

  function applySearch() {
    updateFilter("search", searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft("");
    updateFilter("search", "");
  }

  function updateYear(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") {
      params.delete("from");
      params.delete("to");
    } else if (value !== "custom") {
      params.set("from", `${value}-01-01`);
      params.set("to", `${value}-12-31`);
    }
    params.delete("offset");
    if (lockedAccountId) params.set("accountId", lockedAccountId);
    const basePath = lockedAccountId ? `/books/accounts/${lockedAccountId}/transactions` : "/books/transactions";
    router.push(`${basePath}?${params.toString()}`);
  }

  function updateOffset(nextOffset: number) {
    const params = new URLSearchParams(window.location.search);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    else params.delete("offset");
    if (lockedAccountId) params.set("accountId", lockedAccountId);
    const basePath = lockedAccountId ? `/books/accounts/${lockedAccountId}/transactions` : "/books/transactions";
    router.push(`${basePath}?${params.toString()}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function runPlaidBackfill() {
    const accountId = lockedAccountId ?? filters.accountId;
    const target = accountId ? "the selected account" : "all active Plaid-connected accounts";
    if (!window.confirm(`Backfill ${backfillYear} Plaid transactions for ${target}? This may take a minute and will not duplicate existing Plaid transactions.`)) return;

    setIsBackfilling(true);
    setBackfillSummary(null);
    try {
      const res = await fetch("/api/plaid/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId || undefined,
          start_date: `${backfillYear}-01-01`,
          end_date: `${backfillYear}-12-31`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Plaid backfill failed");

      const totalReturned = (data.results ?? []).reduce((sum: number, result: any) => sum + Number(result.plaid_returned ?? 0), 0);
      const totalUpserted = (data.results ?? []).reduce((sum: number, result: any) => sum + Number(result.upserted ?? 0), 0);
      const totalCategorized = (data.results ?? []).reduce((sum: number, result: any) => sum + Number(result.categorized ?? 0), 0);
      const reconnectCount = (data.results ?? []).filter((result: any) => result.needs_reconnect_for_more_history).length;
      const summary = reconnectCount > 0
        ? `Backfill finished: Plaid returned ${totalReturned} transactions, upserted ${totalUpserted}, and auto-categorized ${totalCategorized}. ${reconnectCount} item(s) returned no 2025 history and may need reconnecting with 24-month history.`
        : `Backfill finished: Plaid returned ${totalReturned} transactions, upserted ${totalUpserted}, and auto-categorized ${totalCategorized}.`;
      setBackfillSummary(summary);
      toast.success(summary);
      router.refresh();
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", String(pageSize));
      const refreshed = await fetch(`/api/books/transactions?${params.toString()}`, { cache: "no-store" });
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        setRows(refreshedData.transactions ?? []);
        setCount(refreshedData.count ?? 0);
        setCategoryOptions(refreshedData.categories ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Plaid backfill failed";
      toast.error(message);
      setBackfillSummary(message);
    } finally {
      setIsBackfilling(false);
    }
  }

  async function runBulkCategorization(useAI = true) {
    setIsCategorizing(true);
    setCategorizeMode(useAI ? "ai" : "rules");
    setCategorizeSummary(null);
    try {
      const res = await fetch("/api/books/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5000, useAI, minConfidence: 0.85 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to categorize transactions");

      const summary = useAI
        ? `Categorized ${data.categorized} of ${data.scanned} reviewed transactions (${data.learnedMatches} learned, ${data.ruleMatches} rules, ${data.aiMatches} AI). ${data.needsReview} still need review.`
        : `Applied rules to ${data.categorized} of ${data.scanned} uncategorized transactions (${data.learnedMatches} learned, ${data.ruleMatches} rules). ${data.needsReview} still need review.`;
      setCategorizeSummary(summary);
      toast.success(summary);
      router.refresh();

      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", String(pageSize));
      const refreshed = await fetch(`/api/books/transactions?${params.toString()}`, { cache: "no-store" });
      const refreshedData = await refreshed.json();
      if (refreshed.ok) {
        setRows(refreshedData.transactions ?? []);
        setCount(refreshedData.count ?? 0);
        setCategoryOptions(refreshedData.categories ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to categorize transactions";
      toast.error(message);
      setClientError(message);
    } finally {
      setIsCategorizing(false);
      setCategorizeMode(null);
    }
  }

  async function assignCategory(transactionId: string, categoryId: string) {
    const previousRows = rows;
    const nextCategoryId = categoryId === "uncategorized" ? null : categoryId;
    const nextCategory = categoryOptions.find((category) => String(category.id) === String(nextCategoryId));

    setRows((current) => current.map((tx) => tx.id === transactionId
      ? { ...tx, category_id: nextCategoryId, books_categories: nextCategory ? { name: nextCategory.name } : null }
      : tx
    ));

    try {
      const res = await fetch("/api/books/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transactionId, categoryId: nextCategoryId, learnRule: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update category");
      if (nextCategory) {
        const appliedMatches = Number(data.appliedMatches ?? 0);
        toast.success(
          appliedMatches > 0
            ? `Categorized as ${nextCategory.name}; rule applied to ${appliedMatches} matching uncategorized transaction${appliedMatches === 1 ? "" : "s"}`
            : `Categorized as ${nextCategory.name}; rule saved for future matches`
        );
        if (appliedMatches > 0) {
          router.refresh();
          const params = new URLSearchParams(searchParams.toString());
          params.set("limit", String(pageSize));
          const refreshed = await fetch(`/api/books/transactions?${params.toString()}`, { cache: "no-store" });
          if (refreshed.ok) {
            const refreshedData = await refreshed.json();
            setRows(refreshedData.transactions ?? []);
            setCount(refreshedData.count ?? 0);
            setCategoryOptions(refreshedData.categories ?? []);
          }
        }
      } else {
        toast.success("Marked uncategorized");
      }
    } catch (error) {
      setRows(previousRows);
      toast.error(error instanceof Error ? error.message : "Unable to update category");
    }
  }

  // Helper to check if transaction was auto-assigned by rule
  function getRuleAssignment(tx: Props["transactions"][0]) {
    const taxViews = tx.books_tax_transaction_views ?? [];
    const ruleAssigned = taxViews.find(v => v.tax_notes?.includes("Auto-assigned by rule"));
    if (ruleAssigned) {
      const entity = entities.find(e => e.id === ruleAssigned.tax_entity_id);
      return {
        entityName: entity?.name ?? "Unknown",
        percentage: ruleAssigned.business_percentage,
      };
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push(backHref ?? "/books");
          }}
        >
          ← Back
        </Button>
      </div>

      <PageHeader title={title} description={headerDescription} actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runBulkCategorization(false)} disabled={isCategorizing}>
            {isCategorizing && categorizeMode === "rules" ? "Applying rules…" : "Apply Rules"}
          </Button>
          <Button onClick={() => runBulkCategorization(true)} disabled={isCategorizing} variant="outline">
            {isCategorizing && categorizeMode === "ai" ? "Categorizing…" : "Rules + AI"}
          </Button>
          <Link href="/books/category-rules">
            <Button variant="outline">Category Rules</Button>
          </Link>
          <Link href="/books/transactions/duplicates">
            <Button variant="outline">Duplicate Review</Button>
          </Link>
          <Button onClick={runPlaidBackfill} disabled={isBackfilling} variant="outline">
            {isBackfilling ? "Backfilling Plaid…" : `Backfill Plaid ${backfillYear}`}
          </Button>
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={backfillYear}
            onChange={(event) => setBackfillYear(event.target.value)}
            disabled={isBackfilling}
            aria-label="Backfill year"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Link href="/books/transactions/import">
            <Button variant="outline">Import CSV</Button>
          </Link>
        </div>
      } />

      {categorizeSummary && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {categorizeSummary}
        </div>
      )}

      {backfillSummary && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {backfillSummary}
        </div>
      )}

      {clientError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {clientError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-80 flex-1 gap-2">
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
              if (event.key === "Escape") clearSearch();
            }}
            placeholder="Search description or merchant…"
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <Button variant="outline" onClick={applySearch}>Search</Button>
          {filters.search && <Button variant="ghost" onClick={clearSearch}>Clear</Button>}
        </div>
        {/* Account filter */}
        {!lockedAccountId && accounts.length > 0 && (
          <Select value={filters.accountId ?? "all"} onValueChange={(v) => updateFilter("accountId", v)}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Global search — all accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>{accountOptionLabel(account)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!lockedAccountId && accounts.length === 0 && (
          <Select value={filters.accountId ?? "all"} onValueChange={(v) => updateFilter("accountId", v)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {udas.map((u) => {
                const udaAccounts = u.books_financial_accounts ?? [];
                if (udaAccounts.length === 0) return null;
                return (
                  <SelectGroup key={u.id}>
                    <SelectLabel>{u.name}</SelectLabel>
                    {udaAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {/* Category filter */}
        <Select value={filters.categoryId ?? "all"} onValueChange={(v) => updateFilter("categoryId", v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Year / date range filters */}
        <Select value={selectedYear} onValueChange={updateYear}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {yearOptions.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          From
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => updateFilter("from", event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          To
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => updateFilter("to", event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>


      {!shouldLoadTransactions && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-muted-foreground">
          <div className="text-base font-medium text-foreground">Global Transaction Search</div>
          <p className="mt-2 text-sm">{emptyQueryMessage}</p>
          <p className="mt-1 text-xs">Choose an account to browse its transactions, or search globally across all accounts.</p>
        </div>
      )}

      {shouldLoadTransactions && <>
      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-8 p-3 text-left">
                <input
                  type="checkbox"
                  className="rounded"
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((t) => t.id)) : new Set())}
                />
              </th>
              <th className="p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Description</th>
              <th className="p-3 text-left font-medium">Account</th>
              <th className="p-3 text-left font-medium">Category</th>
              <th className="p-3 text-right font-medium">Amount</th>
              <th className="p-3 text-left font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading transactions…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No transactions yet.{" "}
                  <Link href="/books/transactions/import" className="underline">
                    Import your first CSV
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((tx) => (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                    />
                  </td>
                  <td className="p-3 tabular-nums text-muted-foreground">{formatDate(tx.date)}</td>
                  <td className="p-3 max-w-xs truncate">{tx.description}</td>
                  <td className="p-3 text-muted-foreground">{tx.books_financial_accounts?.name ?? "—"}</td>
                  <td className="p-3">
                    <Select
                      value={tx.category_id ? String(tx.category_id) : "uncategorized"}
                      onValueChange={(value) => assignCategory(tx.id, value)}
                    >
                      <SelectTrigger className="h-8 w-56 rounded-full bg-white text-xs">
                        <SelectValue placeholder="Uncategorized" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={`p-3 text-right tabular-nums font-medium ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="p-3 flex gap-1 flex-wrap">
                    {tx.is_transfer && <Badge variant="outline" className="text-xs">Transfer</Badge>}
                    {(() => {
                      const ruleAssignment = getRuleAssignment(tx);
                      if (ruleAssignment) {
                        return (
                          <Badge 
                            variant="secondary" 
                            className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-help"
                            title={`Auto-assigned to ${ruleAssignment.entityName} @ ${ruleAssignment.percentage}%`}
                          >
                            {ruleAssignment.entityName} ({ruleAssignment.percentage}%)
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <div>
          Showing {visibleStart}-{visibleEnd} of {count} transactions · Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateOffset(Math.max(0, currentOffset - pageSize))}
            disabled={isLoading || currentOffset === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateOffset(currentOffset + pageSize)}
            disabled={isLoading || currentOffset + pageSize >= count}
          >
            Next
          </Button>
        </div>
      </div>
      </>}
    </div>
  );
}
