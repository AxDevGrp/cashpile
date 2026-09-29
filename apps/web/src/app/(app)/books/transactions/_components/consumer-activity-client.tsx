"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@cashpile/ui";
import { listTransactions } from "@/modules/books/actions/transaction.actions";

interface ActivityRow {
  id: string;
  date: string;
  description: string | null;
  merchant: string | null;
  amount: number | null;
  transaction_type: string | null;
  financial_account_id: string | null;
  category_id: number | null;
  metadata?: Record<string, unknown> | null;
}

interface AccountOption {
  id: string;
  name: string;
}

const PAGE = 50;

function isPending(row: ActivityRow): boolean {
  return row.metadata?.pending === true;
}

export function ConsumerActivityClient({
  initial,
  accounts,
  categories,
}: {
  initial: { data: ActivityRow[]; count: number };
  accounts: AccountOption[];
  categories: Array<{ id: number; name: string }>;
}) {
  const [rows, setRows] = useState<ActivityRow[]>(initial.data);
  const [count, setCount] = useState(initial.count);
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const filters = useCallback(
    () => ({
      accountId: accountId || undefined,
      dateFrom: from || undefined,
      dateTo: to || undefined,
      search: search || undefined,
    }),
    [accountId, from, to, search]
  );

  const applyFilters = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTransactions({ ...filters(), limit: PAGE, offset: 0 });
      setRows(result.data as ActivityRow[]);
      setCount(result.count);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTransactions({ ...filters(), limit: PAGE, offset: rows.length });
      const incoming = result.data as ActivityRow[];
      const seen = new Set(rows.map((r) => r.id));
      setRows([...rows, ...incoming.filter((r) => !seen.has(r.id))]);
      setCount(result.count);
    } finally {
      setLoading(false);
    }
  }, [filters, rows]);

  const categoryName = (id: number | null) =>
    id == null ? null : categories.find((c) => c.id === id)?.name ?? null;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Activity</h1>
        <span className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
          {count} transactions
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
          style={{ borderColor: "var(--cp-border, #46515f)" }}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
          style={{ borderColor: "var(--cp-border, #46515f)" }}
        />
        <input
          type="date"
          aria-label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
          style={{ borderColor: "var(--cp-border, #46515f)" }}
        />
        <input
          type="search"
          aria-label="Search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm min-h-[44px] flex-1"
          style={{ borderColor: "var(--cp-border, #46515f)" }}
        />
        <button
          type="button"
          onClick={applyFilters}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] disabled:opacity-50"
          style={{ background: "var(--cp-lime, #c7f65a)", color: "var(--cp-on-lime, #11180a)" }}
        >
          Apply
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
          No transactions yet.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--cp-border, #46515f)" }}>
          {rows.map((row) => {
            const cat = categoryName(row.category_id);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="w-full text-left py-3 flex items-center justify-between gap-3 min-h-[44px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{row.merchant ?? row.description ?? "Transaction"}</span>
                    <span className="block text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
                      {row.date}
                      {isPending(row) ? " · Pending" : ""}
                      {cat ? ` · ${cat}` : " · No category"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(Number(row.amount ?? 0))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length < count ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="rounded-lg border px-4 py-2 text-sm min-h-[44px] disabled:opacity-50"
          style={{ borderColor: "var(--cp-border, #46515f)" }}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {selected ? (
        <section className="rounded-2xl p-5 space-y-2" style={{ background: "var(--cp-surface, #252b34)" }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-medium">{selected.merchant ?? selected.description}</h2>
            <button type="button" onClick={() => setSelected(null)} className="text-sm" aria-label="Close detail">
              ✕
            </button>
          </div>
          <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            {selected.date} · {formatCurrency(Number(selected.amount ?? 0))}
            {isPending(selected) ? " · Pending" : ""}
          </p>
          <p className="text-sm">
            {categoryName(selected.category_id) ?? "No category confirmed yet"}
          </p>
          <Link href="/books/transactions/ai-review" className="text-sm underline">
            Change interpretation →
          </Link>
        </section>
      ) : null}
    </div>
  );
}
