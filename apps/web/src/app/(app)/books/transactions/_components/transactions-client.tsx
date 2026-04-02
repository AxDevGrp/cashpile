"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@cashpile/ui";
import { Button } from "@cashpile/ui";
import { Badge } from "@cashpile/ui";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@cashpile/ui";
import { formatCurrency, formatDate } from "@cashpile/ui";
import type { BooksTransaction, BooksEntity, BooksCategory, BooksUda } from "@/modules/books/types";

interface Props {
  transactions: (BooksTransaction & { books_categories?: { name: string } | null; books_financial_accounts?: { name: string } | null })[];
  totalCount: number;
  entities: BooksEntity[];
  categories: BooksCategory[];
  udas: (BooksUda & { books_financial_accounts?: { id: string; name: string }[] })[];
  filters: { udaId?: string; accountId?: string; categoryId?: string; from?: string; to?: string };
}

export default function TransactionsClient({ transactions, totalCount, entities, categories, udas, filters }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/books/transactions?${params.toString()}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description={`${totalCount} transactions`} actions={
        <Link href="/books/transactions/import">
          <Button>Import CSV</Button>
        </Link>
      } />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* UDA filter */}
        <Select value={filters.udaId ?? "all"} onValueChange={(v) => updateFilter("udaId", v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {udas.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Individual account filter — grouped by UDA */}
        <Select value={filters.accountId ?? "all"} onValueChange={(v) => updateFilter("accountId", v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All sub-accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sub-accounts</SelectItem>
            {udas.map((u) => {
              const accounts = u.books_financial_accounts ?? [];
              if (accounts.length === 0) return null;
              return (
                <SelectGroup key={u.id}>
                  <SelectLabel>{u.name}</SelectLabel>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select value={filters.categoryId ?? "all"} onValueChange={(v) => updateFilter("categoryId", v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-8 p-3 text-left">
                <input
                  type="checkbox"
                  className="rounded"
                  onChange={(e) => setSelected(e.target.checked ? new Set(transactions.map((t) => t.id)) : new Set())}
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
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No transactions yet.{" "}
                  <Link href="/books/transactions/import" className="underline">
                    Import your first CSV
                  </Link>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
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
                    {tx.books_categories ? (
                      <Badge variant="secondary">{tx.books_categories.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Uncategorized</span>
                    )}
                  </td>
                  <td className={`p-3 text-right tabular-nums font-medium ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="p-3 flex gap-1">
                    {tx.is_transfer && <Badge variant="outline" className="text-xs">Transfer</Badge>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
