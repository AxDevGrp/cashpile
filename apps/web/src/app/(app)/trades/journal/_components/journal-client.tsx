"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, Button, Badge } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { formatCurrency } from "@cashpile/ui";
import type { TradesEntry, TradesPropAccount } from "@/modules/trades/types";

interface Props {
  trades: TradesEntry[];
  totalCount: number;
  accounts: TradesPropAccount[];
  filters: {
    accountId?: string;
    instrument?: string;
    direction?: string;
    from?: string;
    to?: string;
    open?: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  evaluation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  funded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  breached: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  passed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function JournalClient({ trades, totalCount, accounts, filters }: Props) {
  const router = useRouter();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") { params.set(key, value); } else { params.delete(key); }
    router.push(`/trades/journal?${params.toString()}`);
  }

  const openTrades = trades.filter((t) => t.is_open);
  const closedTrades = trades.filter((t) => !t.is_open);
  const totalPnl = closedTrades.reduce((s, t) => s + (t.net_pnl ?? 0), 0);
  const wins = closedTrades.filter((t) => (t.net_pnl ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade Journal"
        description={`${totalCount} trades`}
        actions={
          <Link href="/trades/journal/new">
            <Button>+ New Trade</Button>
          </Link>
        }
      />

      {/* Summary strip */}
      {closedTrades.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Closed Trades", value: closedTrades.length.toString() },
            { label: "Win Rate", value: `${winRate.toFixed(1)}%` },
            { label: "Total Net P&L", value: formatCurrency(totalPnl), color: totalPnl >= 0 ? "text-green-600" : "text-red-600" },
            { label: "Open Positions", value: openTrades.length.toString() },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-semibold mt-0.5 ${color ?? ""}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filters.accountId ?? "all"} onValueChange={(v) => updateFilter("accountId", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.firm_name}{a.account_label ? ` — ${a.account_label}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.open ?? "all"} onValueChange={(v) => updateFilter("open", v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All trades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trades</SelectItem>
            <SelectItem value="true">Open only</SelectItem>
            <SelectItem value="false">Closed only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.direction ?? "all"} onValueChange={(v) => updateFilter("direction", v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both sides</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trade table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">Entry Time</th>
              <th className="p-3 text-left font-medium">Instrument</th>
              <th className="p-3 text-left font-medium">Dir</th>
              <th className="p-3 text-right font-medium">Size</th>
              <th className="p-3 text-right font-medium">Entry</th>
              <th className="p-3 text-right font-medium">Exit</th>
              <th className="p-3 text-right font-medium">Net P&L</th>
              <th className="p-3 text-right font-medium">R</th>
              <th className="p-3 text-left font-medium">Setup</th>
              <th className="p-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                  No trades yet.{" "}
                  <Link href="/trades/journal/new" className="underline">Log your first trade</Link>
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(t.entry_time)}
                  </td>
                  <td className="p-3 font-medium">{t.instrument}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      t.direction === "long"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}>
                      {t.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{t.size}</td>
                  <td className="p-3 text-right tabular-nums">{t.entry_price.toFixed(2)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {t.exit_price?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`p-3 text-right tabular-nums font-semibold ${
                    t.net_pnl === null ? "text-muted-foreground"
                      : t.net_pnl >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {t.net_pnl !== null ? formatCurrency(t.net_pnl) : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {t.r_multiple !== null ? `${t.r_multiple.toFixed(2)}R` : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{t.setup_tag ?? "—"}</td>
                  <td className="p-3">
                    {t.is_open ? (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">Open</Badge>
                    ) : (
                      <Badge variant="outline" className={`text-xs ${(t.net_pnl ?? 0) >= 0 ? "text-green-600 border-green-400" : "text-red-600 border-red-400"}`}>
                        {(t.net_pnl ?? 0) >= 0 ? "Win" : "Loss"}
                      </Badge>
                    )}
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
