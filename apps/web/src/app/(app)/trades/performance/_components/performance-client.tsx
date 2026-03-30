"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PageHeader } from "@cashpile/ui";
import { formatCurrency } from "@cashpile/ui";
import type {
  TradesPropAccount,
  PerformanceStats,
  EquityCurvePoint,
  PnlByInstrument,
  PnlBySetup,
} from "@/modules/trades/types";

interface Props {
  accounts: TradesPropAccount[];
  activeAccountId: string | null;
  stats: PerformanceStats | null;
  equityCurve: EquityCurvePoint[];
  byInstrument: PnlByInstrument[];
  bySetup: PnlBySetup[];
  from?: string;
  to?: string;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function PnlCell({ value }: { value: number }) {
  const color = value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-muted-foreground";
  return (
    <span className={`font-medium ${color}`}>
      {value >= 0 ? "+" : ""}
      {formatCurrency(value)}
    </span>
  );
}

export default function PerformanceClient({
  accounts,
  activeAccountId,
  stats,
  equityCurve,
  byInstrument,
  bySetup,
  from,
  to,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Equity curve, win rate, and P&L breakdown"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Account</label>
          <select
            value={activeAccountId ?? ""}
            onChange={(e) => navigate("accountId", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firm_name}
                {a.account_label ? ` — ${a.account_label}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            defaultValue={from ?? ""}
            onBlur={(e) => navigate("from", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            defaultValue={to ?? ""}
            onBlur={(e) => navigate("to", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">No accounts found</p>
          <p className="text-sm mt-1">Add a prop firm account to see performance data.</p>
        </div>
      ) : !stats ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="text-sm">No closed trades found for the selected period.</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Trades" value={stats.totalTrades.toString()} />
            <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub={`L: ${stats.longWinRate.toFixed(1)}% S: ${stats.shortWinRate.toFixed(1)}%`} />
            <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} />
            <StatCard label="Avg R" value={stats.avgRMultiple.toFixed(2)} sub={`Best: ${stats.bestTrade >= 0 ? "+" : ""}${formatCurrency(stats.bestTrade)}`} />
            <StatCard label="Total Net P&L" value={`${stats.totalNetPnl >= 0 ? "+" : ""}${formatCurrency(stats.totalNetPnl)}`} />
            <StatCard label="Avg Win / Loss" value={`${formatCurrency(stats.avgWin)} / ${formatCurrency(stats.avgLoss)}`} />
          </div>

          {/* Equity curve */}
          {equityCurve.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm mb-2">Equity Curve</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-right">Opening</th>
                      <th className="px-4 py-2 text-right">Closing</th>
                      <th className="px-4 py-2 text-right">Daily P&L</th>
                      <th className="px-4 py-2 text-right">Drawdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equityCurve.map((row) => (
                      <tr key={row.date} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-mono text-xs">{row.date}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.balance - row.dailyPnl)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.balance)}</td>
                        <td className="px-4 py-2 text-right">
                          <PnlCell value={row.dailyPnl} />
                        </td>
                        <td className={`px-4 py-2 text-right text-xs ${row.drawdownPct > 5 ? "text-red-600" : row.drawdownPct > 2 ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {row.drawdownPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* P&L by Instrument */}
          {byInstrument.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm mb-2">P&L by Instrument</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Instrument</th>
                      <th className="px-4 py-2 text-right">Trades</th>
                      <th className="px-4 py-2 text-right">Win Rate</th>
                      <th className="px-4 py-2 text-right">Avg P&L</th>
                      <th className="px-4 py-2 text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byInstrument.map((row) => (
                      <tr key={row.instrument} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{row.instrument}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{row.tradeCount}</td>
                        <td className="px-4 py-2 text-right">{row.winRate.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right">
                          <PnlCell value={row.avgNetPnl} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <PnlCell value={row.netPnl} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* P&L by Setup */}
          {bySetup.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm mb-2">P&L by Setup</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Setup Tag</th>
                      <th className="px-4 py-2 text-right">Trades</th>
                      <th className="px-4 py-2 text-right">Win Rate</th>
                      <th className="px-4 py-2 text-right">Avg R</th>
                      <th className="px-4 py-2 text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySetup.map((row) => (
                      <tr key={row.setupTag} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{row.setupTag}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{row.tradeCount}</td>
                        <td className="px-4 py-2 text-right">{row.winRate.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right">{row.avgRMultiple.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">
                          <PnlCell value={row.netPnl} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
