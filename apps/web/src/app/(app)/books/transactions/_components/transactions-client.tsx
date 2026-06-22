"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@cashpile/ui";
import { Button } from "@cashpile/ui";
import { Badge } from "@cashpile/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@cashpile/ui";
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
  accounts?: { id: string; name: string; tax_entity_id?: string | null; institution_name?: string | null; institution?: string | null; last_four_digits?: string | null }[];
  filters: { taxEntityId?: string; udaId?: string; accountId?: string; categoryId?: string; from?: string; to?: string; search?: string; filter?: "uncategorized" | "categorized" };
  loadError?: string;
  title?: string;
  description?: string;
  descriptionContext?: string;
  backHref?: string;
  lockedAccountId?: string;
  requireQuery?: boolean;
  emptyQueryMessage?: string;
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);
  for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

function categoryType(category: BooksCategory) {
  return category.category_type ?? category.type ?? "expense";
}

function categoryParentId(category: BooksCategory) {
  return category.parent_category_id ?? category.parent_id ?? null;
}

function categoryLabel(category: BooksCategory, categories: BooksCategory[]) {
  const parentId = categoryParentId(category);
  const parent = parentId ? categories.find((item) => String(item.id) === String(parentId)) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function categoryAudit(tx: BooksTransaction) {
  const audit = tx.metadata?.category_assignment as {
    method?: string;
    confidence?: number;
    category_name?: string;
    pattern?: string | null;
    rule_scope?: string;
    assigned_at?: string;
  } | undefined;
  if (!audit?.method) return null;
  const label = audit.method === "ai"
    ? "AI category"
    : audit.method === "ai_review"
      ? "AI review"
      : audit.method === "ai_instruction"
        ? "AI instruction"
        : audit.method === "category_rule"
          ? "Category rule"
          : audit.method === "learned_rule"
            ? "Learned rule"
            : audit.method.replace(/_/g, " ");
  const confidence = typeof audit.confidence === "number" ? ` · ${Math.round(audit.confidence * 100)}% confidence` : "";
  const scope = audit.rule_scope ? ` · ${audit.rule_scope === "account" ? "account-scoped" : "global"}` : "";
  const pattern = audit.pattern ? ` · pattern: ${audit.pattern}` : "";
  return { label, title: `${label}${confidence}${scope}${pattern}` };
}

function categorySuggestion(tx: BooksTransaction) {
  const suggestion = tx.metadata?.category_suggestion as {
    category_id?: string | number;
    category_name?: string;
    confidence?: number;
    method?: string;
  } | undefined;
  if (!suggestion?.category_id || !suggestion?.category_name) return null;
  const confidence = typeof suggestion.confidence === "number" ? ` · ${Math.round(suggestion.confidence * 100)}% confidence` : "";
  const method = suggestion.method ? ` · ${suggestion.method.replace(/_/g, " ")}` : "";
  return {
    categoryId: suggestion.category_id,
    label: `AI suggested: ${suggestion.category_name}`,
    title: `Review before applying${confidence}${method}`,
  };
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
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [categorizeMode, setCategorizeMode] = useState<"rules" | "ai" | null>(null);
  const [categorizeSummary, setCategorizeSummary] = useState<string | null>(null);
  const [categorizeNeedsReview, setCategorizeNeedsReview] = useState(0);
  const [categorizeReviewSuggestions, setCategorizeReviewSuggestions] = useState(0);
  const [categorizeExamples, setCategorizeExamples] = useState<Array<{
    description: string;
    categoryName: string;
    confidence: number;
    method: string;
  }>>([]);
  const [backfillSummary, setBackfillSummary] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillYear, setBackfillYear] = useState("2025");
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [addCategoryForTransactionId, setAddCategoryForTransactionId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState("none");
  const [newCategoryType, setNewCategoryType] = useState("expense");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  const rootCategories = categoryOptions.filter((category) => !categoryParentId(category));
  const sortedCategoryOptions = [...categoryOptions].sort((a, b) => (
    categoryLabel(a, categoryOptions).localeCompare(categoryLabel(b, categoryOptions))
  ));
  const selectedYear = filters.from?.match(/^\d{4}-01-01$/) && filters.to === `${filters.from.slice(0, 4)}-12-31`
    ? filters.from.slice(0, 4)
    : filters.from || filters.to
      ? "custom"
      : "all";
  const hasActiveQuery = Boolean(
    filters.search?.trim() ||
    filters.taxEntityId ||
    filters.accountId ||
    filters.udaId ||
    filters.categoryId ||
    filters.filter ||
    filters.from ||
    filters.to ||
    lockedAccountId
  );
  const shouldLoadTransactions = !requireQuery || hasActiveQuery;
  const pageSize = 100;
  const requestedOffset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const currentPage = count === 0 ? 1 : Math.min(totalPages, Math.floor(requestedOffset / pageSize) + 1);
  const currentOffset = (currentPage - 1) * pageSize;
  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  const visibleStart = count === 0 || rows.length === 0 ? 0 : requestedOffset + 1;
  const visibleEnd = Math.min(requestedOffset + rows.length, count);
  const categorizationAccountId = lockedAccountId ?? filters.accountId ?? null;
  const aiReviewHref = categorizationAccountId
    ? `/books/transactions/ai-review?accountId=${encodeURIComponent(categorizationAccountId)}`
    : "/books/transactions/ai-review";
  const aiReviewHrefForTransaction = (tx: BooksTransaction) => {
    const accountId = tx.account_id;
    return accountId
      ? `/books/transactions/ai-review?accountId=${encodeURIComponent(accountId)}`
      : aiReviewHref;
  };
  const uncategorizedHref = categorizationAccountId
    ? `/books/transactions?filter=uncategorized&accountId=${encodeURIComponent(categorizationAccountId)}`
    : "/books/transactions?filter=uncategorized";
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
        if (filters.taxEntityId && !params.has("taxEntityId")) params.set("taxEntityId", filters.taxEntityId);
        if (filters.accountId && !params.has("accountId")) params.set("accountId", filters.accountId);
        if (filters.udaId && !params.has("udaId")) params.set("udaId", filters.udaId);
        if (filters.categoryId && !params.has("categoryId")) params.set("categoryId", filters.categoryId);
        if (filters.filter && !params.has("filter")) params.set("filter", filters.filter);
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
  }, [filters.accountId, filters.categoryId, filters.filter, filters.from, filters.search, filters.taxEntityId, filters.to, filters.udaId, searchParams, shouldLoadTransactions]);

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

  function updatePage(page: number) {
    updateOffset((page - 1) * pageSize);
  }

  function openAddCategory(transactionId?: string | null) {
    const currentTransaction = transactionId ? rows.find((tx) => tx.id === transactionId) : null;
    setAddCategoryForTransactionId(transactionId ?? null);
    setNewCategoryName("");
    setNewCategoryParentId("none");
    setNewCategoryType(currentTransaction?.amount && currentTransaction.amount > 0 ? "income" : "expense");
    setIsAddCategoryOpen(true);
  }

  async function createInlineCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Enter a category name");
      return;
    }

    const parent = newCategoryParentId === "none"
      ? null
      : categoryOptions.find((category) => String(category.id) === newCategoryParentId);
    const effectiveType = parent ? categoryType(parent) : newCategoryType;

    setIsCreatingCategory(true);
    try {
      const res = await fetch("/api/books/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentCategoryId: parent?.id ?? null,
          categoryType: effectiveType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to create category");

      setCategoryOptions(data.categories ?? [...categoryOptions, data.category]);
      setNewCategoryName("");
      setNewCategoryParentId("none");
      setAddCategoryForTransactionId(null);
      setIsAddCategoryOpen(false);
      toast.success(parent ? `Added ${parent.name} / ${data.category.name}` : `Added ${data.category.name}`);

      if (addCategoryForTransactionId) {
        await assignCategory(addCategoryForTransactionId, String(data.category.id), data.category);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create category");
    } finally {
      setIsCreatingCategory(false);
    }
  }

  function openEditCategory() {
    const firstCategory = sortedCategoryOptions[0];
    setEditCategoryId(firstCategory ? String(firstCategory.id) : "");
    setEditCategoryName(firstCategory?.name ?? "");
    setIsEditCategoryOpen(true);
  }

  async function updateInlineCategory() {
    const name = editCategoryName.trim();
    if (!editCategoryId) {
      toast.error("Choose a category to edit");
      return;
    }
    if (!name) {
      toast.error("Enter a category name");
      return;
    }

    setIsUpdatingCategory(true);
    try {
      const res = await fetch("/api/books/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editCategoryId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update category");

      setCategoryOptions(data.categories ?? categoryOptions.map((category) => (
        String(category.id) === editCategoryId ? { ...category, name } : category
      )));
      setRows((current) => current.map((tx) => (
        String(tx.category_id) === editCategoryId
          ? { ...tx, books_categories: { name } }
          : tx
      )));
      setIsEditCategoryOpen(false);
      toast.success(`Renamed category to ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update category");
    } finally {
      setIsUpdatingCategory(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function applyBulkCategory() {
    if (selected.size === 0) {
      toast.error("Select transactions first");
      return;
    }
    if (!bulkCategoryId) {
      toast.error("Choose a category to apply");
      return;
    }

    const ids = Array.from(selected);
    const nextCategoryId = bulkCategoryId === "uncategorized" ? null : bulkCategoryId;
    const nextCategory = nextCategoryId
      ? categoryOptions.find((category) => String(category.id) === String(nextCategoryId))
      : null;
    const previousRows = rows;

    setIsBulkUpdating(true);
    setRows((current) => current.map((tx) => (
      selected.has(tx.id)
        ? { ...tx, category_id: nextCategoryId, books_categories: nextCategory ? { name: nextCategory.name } : null }
        : tx
    )));

    try {
      const res = await fetch("/api/books/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, categoryId: nextCategoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update selected transactions");

      setSelected(new Set());
      setBulkCategoryId("");
      const appliedMatches = Number(data.appliedMatches ?? 0);
      const learnedRules = Number(data.learnedRules ?? 0);
      const taxAssigned = Number(data.taxAssigned ?? 0);
      toast.success(
        nextCategory
          ? `Updated ${data.updated ?? ids.length} selected transaction${ids.length === 1 ? "" : "s"}, saved ${learnedRules} learned rule${learnedRules === 1 ? "" : "s"}, applied to ${appliedMatches} other match${appliedMatches === 1 ? "" : "es"}, and assigned ${taxAssigned} to Tax Entities`
          : `Updated ${data.updated ?? ids.length} selected transaction${ids.length === 1 ? "" : "s"}`
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
    } catch (error) {
      setRows(previousRows);
      toast.error(error instanceof Error ? error.message : "Unable to update selected transactions");
    } finally {
      setIsBulkUpdating(false);
    }
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
    setCategorizeNeedsReview(0);
    setCategorizeReviewSuggestions(0);
    setCategorizeExamples([]);
    try {
      const res = await fetch("/api/books/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5000, useAI, minConfidence: 0.85, accountId: categorizationAccountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to categorize transactions");

      const summary = useAI
        ? `Categorized ${data.categorized} of ${data.scanned} reviewed transactions (${data.learnedMatches} learned, ${data.ruleMatches} rules, ${data.aiMatches} AI). Saved ${data.learnedRulesSaved ?? 0} learned rule${data.learnedRulesSaved === 1 ? "" : "s"}, queued ${data.reviewSuggestions ?? 0} AI suggestion${data.reviewSuggestions === 1 ? "" : "s"} for review, and assigned ${data.taxAssigned ?? 0} to Tax Entities. ${data.needsReview} still need review.`
        : `Applied rules to ${data.categorized} of ${data.scanned} uncategorized transactions (${data.learnedMatches} learned, ${data.ruleMatches} rules) and assigned ${data.taxAssigned ?? 0} to Tax Entities. ${data.needsReview} still need review.`;
      setCategorizeSummary(summary);
      setCategorizeNeedsReview(Number(data.needsReview ?? 0));
      setCategorizeReviewSuggestions(Number(data.reviewSuggestions ?? 0));
      setCategorizeExamples(Array.isArray(data.examples) ? data.examples : []);
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

  async function assignCategory(transactionId: string, categoryId: string, categoryOverride?: BooksCategory) {
    const previousRows = rows;
    const nextCategoryId = categoryId === "uncategorized" ? null : categoryId;
    const nextCategory = categoryOverride ?? categoryOptions.find((category) => String(category.id) === String(nextCategoryId));

    setRows((current) => current.map((tx) => tx.id === transactionId
      ? {
        ...tx,
        category_id: nextCategoryId,
        books_categories: nextCategory ? { name: nextCategory.name } : null,
        metadata: { ...(tx.metadata ?? {}), category_suggestion: null },
      }
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
        const taxAssigned = Number(data.taxAssigned ?? 0);
        toast.success(
          appliedMatches > 0
            ? `Categorized as ${nextCategory.name}; rule applied to ${appliedMatches} matching uncategorized transaction${appliedMatches === 1 ? "" : "s"} and assigned ${taxAssigned} to Tax Entities`
            : `Categorized as ${nextCategory.name}; scanned existing Uncategorized transactions and found no other matches`
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

  async function assignAccount(transactionId: string, accountId: string) {
    const previousRows = rows;
    const nextAccount = accounts.find((account) => account.id === accountId);
    if (!nextAccount) {
      toast.error("Choose an account");
      return;
    }

    setRows((current) => current.map((tx) => tx.id === transactionId
      ? {
        ...tx,
        account_id: accountId,
        financial_account_id: accountId,
        books_financial_accounts: { name: nextAccount.name },
      } as typeof tx
      : tx
    ));

    try {
      const res = await fetch("/api/books/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transactionId, accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update account");
      toast.success(`Moved to ${nextAccount.name}`);
    } catch (error) {
      setRows(previousRows);
      toast.error(error instanceof Error ? error.message : "Unable to update account");
    }
  }

  async function assignTaxEntity(transactionId: string, taxEntityId: string) {
    const previousRows = rows;
    const tx = rows.find((row) => row.id === transactionId);
    if (!tx) return;

    const existingViews = tx.books_tax_transaction_views ?? [];
    const nextViews = taxEntityId === "unassigned"
      ? []
      : [{ tax_entity_id: taxEntityId, tax_notes: "Manually assigned in Transactions", business_percentage: 100 }];
    const nextEntity = entities.find((entity) => entity.id === taxEntityId);

    setRows((current) => current.map((row) => row.id === transactionId
      ? { ...row, books_tax_transaction_views: nextViews }
      : row
    ));

    try {
      for (const view of existingViews) {
        const res = await fetch("/api/tax/assignment", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionIds: [transactionId], taxEntityId: view.tax_entity_id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to update Tax Entity");
      }

      if (taxEntityId !== "unassigned") {
        const res = await fetch("/api/tax/assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionIds: [transactionId],
            taxEntityId,
            businessPct: 100,
            deductionPct: 100,
            isDeductible: true,
            notes: "Manually assigned in Transactions",
            categoryId: tx.category_id ? Number(tx.category_id) : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to update Tax Entity");
      }

      toast.success(nextEntity ? `Assigned to ${nextEntity.name}` : "Removed Tax Entity assignment");
    } catch (error) {
      setRows(previousRows);
      toast.error(error instanceof Error ? error.message : "Unable to update Tax Entity");
    }
  }

  function taxEntitySelectValue(tx: Props["transactions"][0]) {
    const ids = Array.from(new Set((tx.books_tax_transaction_views ?? []).map((view) => view.tax_entity_id)));
    if (ids.length === 0) return "unassigned";
    if (ids.length === 1) return ids[0];
    return "multiple";
  }

  function getTaxAssignments(tx: Props["transactions"][0]) {
    return (tx.books_tax_transaction_views ?? []).map((view) => {
      const note = view.tax_notes ?? "Assigned to Tax Entity";
      const entity = entities.find(e => e.id === view.tax_entity_id);
      const source = note.includes("Auto-assigned by account")
        ? "Account default"
        : note.includes("Auto-assigned by rule")
          ? "Tax rule"
          : note.includes("AI-confirmed rule")
            ? "AI review"
            : note.includes("AI instruction")
              ? "AI instruction"
              : "Tax assignment";
      return {
        entityName: entity?.name ?? "Unknown",
        percentage: view.business_percentage,
        source,
        note,
      };
    });
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
          <Link href={aiReviewHref}>
            <Button variant="outline">AI Review</Button>
          </Link>
          <details className="group relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&::-webkit-details-marker]:hidden">
              Category
              <span className="text-xs text-muted-foreground">▾</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              <Link
                href="/books/category-rules"
                className="block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Rules
              </Link>
              <button
                type="button"
                className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  openAddCategory();
                }}
              >
                Add Category
              </button>
              <button
                type="button"
                className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  openEditCategory();
                }}
                disabled={categoryOptions.length === 0}
              >
                Edit Category
              </button>
            </div>
          </details>
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
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{categorizeSummary}</span>
            {categorizeNeedsReview > 0 && (
              <div className="flex flex-wrap gap-2">
                <Link href={aiReviewHref}>
                  <Button variant="outline" size="sm">
                    {categorizeReviewSuggestions > 0 ? `Review ${categorizeReviewSuggestions} AI suggestion${categorizeReviewSuggestions === 1 ? "" : "s"}` : "Review suggestions"}
                  </Button>
                </Link>
                <Link href={uncategorizedHref}>
                  <Button variant="outline" size="sm">View Uncategorized</Button>
                </Link>
              </div>
            )}
          </div>
          {categorizeExamples.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-white/60 p-3 text-xs text-emerald-900">
              <div className="mb-2 font-medium">Examples Cashpile categorized</div>
              <div className="space-y-1">
                {categorizeExamples.map((example, index) => (
                  <div key={`${example.description}-${index}`} className="grid gap-2 md:grid-cols-[1fr_12rem_9rem]">
                    <span className="truncate">{example.description}</span>
                    <span>{example.categoryName}</span>
                    <span className="text-emerald-700">{example.method.replace(/_/g, " ")} · {Math.round(example.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
        <Button variant="outline" onClick={() => openAddCategory()}>
          Add Category
        </Button>
        <Button variant="outline" onClick={openEditCategory} disabled={categoryOptions.length === 0}>
          Edit Category
        </Button>
        <Select
          value={filters.categoryId ?? "all"}
          onValueChange={(v) => {
            if (v === "__add_category__") {
              openAddCategory();
              return;
            }
            updateFilter("categoryId", v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {sortedCategoryOptions.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {categoryLabel(c, categoryOptions)}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value="__add_category__">+ Add category…</SelectItem>
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
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="font-medium">
            {selected.size} transaction{selected.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger className="w-72 bg-white">
                <SelectValue placeholder="Choose category to apply" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {sortedCategoryOptions.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {categoryLabel(category, categoryOptions)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={applyBulkCategory} disabled={isBulkUpdating || !bulkCategoryId}>
              {isBulkUpdating ? "Applying…" : "Apply to Selected"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(new Set());
                setBulkCategoryId("");
              }}
              disabled={isBulkUpdating}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-8 p-3 text-left">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={rows.length > 0 && rows.every((tx) => selected.has(tx.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((t) => t.id)) : new Set())}
                />
              </th>
              <th className="p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Description</th>
              <th className="p-3 text-left font-medium">Account</th>
              <th className="p-3 text-left font-medium">Category</th>
              <th className="p-3 text-left font-medium">Tax Entity</th>
              <th className="p-3 text-right font-medium">Amount</th>
              <th className="p-3 text-left font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Loading transactions…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
                  <td className="p-3">
                    <Select
                      value={tx.account_id ?? (tx as any).financial_account_id ?? ""}
                      onValueChange={(value) => assignAccount(tx.id, value)}
                    >
                      <SelectTrigger className="h-8 w-56 rounded-full bg-white text-xs">
                        <SelectValue placeholder="Choose account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>{accountOptionLabel(account)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select
                      value={tx.category_id ? String(tx.category_id) : "uncategorized"}
                      onValueChange={(value) => {
                        if (value === "__add_category__") {
                          openAddCategory(tx.id);
                          return;
                        }
                        assignCategory(tx.id, value);
                      }}
                    >
                      <SelectTrigger className="h-8 w-56 rounded-full bg-white text-xs">
                        <SelectValue placeholder="Uncategorized" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                        {sortedCategoryOptions.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {categoryLabel(category, categoryOptions)}
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value="__add_category__">+ Add category…</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select
                      value={taxEntitySelectValue(tx)}
                      onValueChange={(value) => {
                        if (value !== "multiple") assignTaxEntity(tx.id, value);
                      }}
                    >
                      <SelectTrigger className="h-8 w-52 rounded-full bg-white text-xs">
                        <SelectValue placeholder="No Tax Entity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">No Tax Entity</SelectItem>
                        {taxEntitySelectValue(tx) === "multiple" && (
                          <SelectItem value="multiple">Multiple Tax Entities</SelectItem>
                        )}
                        {entities.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
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
                      const audit = categoryAudit(tx);
                      if (!audit) return null;
                      return (
                        <Badge variant="outline" className="text-xs cursor-help" title={audit.title}>
                          {audit.label}
                        </Badge>
                      );
                    })()}
                    {(() => {
                      const suggestion = categorySuggestion(tx);
                      if (!suggestion) return null;
                      return (
                        <>
                          <Link href={aiReviewHrefForTransaction(tx)} title={`${suggestion.title}. Open AI Review.`}>
                            <Badge variant="outline" className="text-xs cursor-pointer border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">
                              {suggestion.label}
                            </Badge>
                          </Link>
                          <button
                            type="button"
                            className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
                            onClick={() => assignCategory(
                              tx.id,
                              String(suggestion.categoryId),
                              categoryOptions.find((category) => String(category.id) === String(suggestion.categoryId))
                            )}
                          >
                            Apply & learn
                          </button>
                        </>
                      );
                    })()}
                    {getTaxAssignments(tx).map((assignment, index) => (
                      <Badge
                        key={`${assignment.entityName}-${index}`}
                        variant="secondary"
                        className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-help"
                        title={`${assignment.source}: ${assignment.note} @ ${assignment.percentage}%`}
                      >
                        {assignment.entityName} ({assignment.percentage}%)
                      </Badge>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <div className="text-center">
          Showing {visibleStart}-{visibleEnd} of {count} transactions · Page {currentPage} of {totalPages}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePage(1)}
            disabled={isLoading || currentOffset === 0}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePage(currentPage - 1)}
            disabled={isLoading || currentOffset === 0}
          >
            Previous
          </Button>
          {pageNumbers.map((page, index) => (
            <div key={page} className="flex items-center gap-2">
              {index > 0 && page - pageNumbers[index - 1] > 1 && (
                <span className="px-1 text-muted-foreground">…</span>
              )}
              <Button
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => updatePage(page)}
                disabled={isLoading || page === currentPage}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePage(currentPage + 1)}
            disabled={isLoading || currentOffset + pageSize >= count}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePage(totalPages)}
            disabled={isLoading || currentOffset + pageSize >= count}
          >
            Last
          </Button>
        </div>
      </div>
      </>}

      <Dialog open={isAddCategoryOpen} onOpenChange={(open) => {
        setIsAddCategoryOpen(open);
        if (!open) {
          setAddCategoryForTransactionId(null);
          setNewCategoryName("");
          setNewCategoryParentId("none");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>
              Create a top-level category or choose a parent to create a sub-category, like Income / Property Income.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Category name</span>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createInlineCategory();
                }}
                placeholder="e.g. W-2 Income, Property Income"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                autoFocus
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Parent category</span>
              <Select
                value={newCategoryParentId}
                onValueChange={(value) => {
                  setNewCategoryParentId(value);
                  const parent = categoryOptions.find((category) => String(category.id) === value);
                  if (parent) setNewCategoryType(categoryType(parent));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent — top-level category</SelectItem>
                  {rootCategories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Type</span>
              <Select
                value={newCategoryType}
                onValueChange={setNewCategoryType}
                disabled={newCategoryParentId !== "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
              {newCategoryParentId !== "none" && (
                <p className="text-xs text-muted-foreground">Sub-categories inherit their parent category type.</p>
              )}
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCategoryOpen(false);
                setAddCategoryForTransactionId(null);
                setNewCategoryName("");
                setNewCategoryParentId("none");
              }}
              disabled={isCreatingCategory}
            >
              Cancel
            </Button>
            <Button onClick={createInlineCategory} disabled={isCreatingCategory}>
              {isCreatingCategory ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>
              Rename an existing category or sub-category. Existing categorized transactions will show the new name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Category</span>
              <Select
                value={editCategoryId}
                onValueChange={(value) => {
                  const category = categoryOptions.find((item) => String(item.id) === value);
                  setEditCategoryId(value);
                  setEditCategoryName(category?.name ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCategoryOptions.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {categoryLabel(category, categoryOptions)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">New name</span>
              <input
                value={editCategoryName}
                onChange={(event) => setEditCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") updateInlineCategory();
                }}
                placeholder="Category name"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                autoFocus
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCategoryOpen(false)} disabled={isUpdatingCategory}>
              Cancel
            </Button>
            <Button onClick={updateInlineCategory} disabled={isUpdatingCategory || !editCategoryId}>
              {isUpdatingCategory ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
