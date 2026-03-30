"use client";

import Link from "next/link";
import { PageHeader, Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import { formatCurrency } from "@cashpile/ui";
import type { TradesPropAccount, RulesCheckResult } from "@/modules/trades/types";

interface Props {
  accounts: TradesPropAccount[];
  rulesMap: Record<string, RulesCheckResult | null>;
}

const STATUS_LABELS: Record<string, string> = {
  evaluation: "Evaluation",
  funded: "Funded",
  breached: "Breached",
  passed: "Passed",
  inactive: "Inactive",
};

const STATUS_COLORS: Record<string, string> = {
  evaluation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  funded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  breached: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  passed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function DrawdownBar({
  current, max, label,
}: {
  current: number; max: number; label: string;
}) {
  const pct = Math.min((current / max) * 100, 100);
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {current.toFixed(2)}% / {max}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountsClient({ accounts, rulesMap }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prop Accounts"
        description="Funded and evaluation account tracker"
        actions={
          <Link href="/trades/accounts/new">
            <Button>+ New Account</Button>
          </Link>
        }
      />

      {accounts.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">No accounts yet</p>
          <p className="text-sm mt-1">Add your first prop firm account to start tracking rules and performance.</p>
          <Link href="/trades/accounts/new">
            <Button className="mt-4">Add Account</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const rules = rulesMap[account.id];
            const drawdownPct =
              account.starting_balance > 0
                ? ((account.starting_balance - account.current_balance) /
                    account.starting_balance) *
                  100
                : 0;
            const profitPct =
              account.starting_balance > 0
                ? ((account.current_balance - account.starting_balance) /
                    account.starting_balance) *
                  100
                : 0;

            return (
              <Card
                key={account.id}
                className={`${
                  account.status === "breached"
                    ? "border-red-300 dark:border-red-700"
                    : rules && !rules.passed
                    ? "border-yellow-300 dark:border-yellow-700"
                    : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{account.firm_name}</CardTitle>
                      {account.account_label && (
                        <p className="text-xs text-muted-foreground mt-0.5">{account.account_label}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        STATUS_COLORS[account.status] ?? ""
                      }`}
                    >
                      {STATUS_LABELS[account.status]}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Balance */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Account Size</p>
                      <p className="font-semibold">{formatCurrency(account.account_size)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current Balance</p>
                      <p className={`font-semibold ${profitPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(account.current_balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">P&L</p>
                      <p className={`font-medium text-sm ${profitPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {profitPct >= 0 ? "+" : ""}
                        {profitPct.toFixed(2)}%
                      </p>
                    </div>
                    {account.profit_target_pct && (
                      <div>
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="font-medium text-sm">{account.profit_target_pct}%</p>
                      </div>
                    )}
                  </div>

                  {/* Rules drawdown bars */}
                  <div className="space-y-2 pt-1 border-t">
                    <DrawdownBar
                      current={drawdownPct}
                      max={account.max_total_drawdown_pct}
                      label="Total Drawdown"
                    />
                    {rules?.dailyStatus && (
                      <DrawdownBar
                        current={rules.dailyStatus.dailyLossPct}
                        max={account.max_daily_drawdown_pct}
                        label="Daily Loss"
                      />
                    )}
                  </div>

                  {/* Breach warnings */}
                  {rules && rules.breachedRules.length > 0 && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2">
                      {rules.breachedRules.map((r) => (
                        <p key={r} className="text-xs text-red-700 dark:text-red-400">{r}</p>
                      ))}
                    </div>
                  )}
                  {rules && rules.warnings.length > 0 && rules.breachedRules.length === 0 && (
                    <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                      {rules.warnings.map((w) => (
                        <p key={w} className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Link href={`/trades/journal?accountId=${account.id}`}>
                      <Button variant="outline" size="sm">Journal</Button>
                    </Link>
                    <Link href={`/trades/performance?accountId=${account.id}`}>
                      <Button variant="outline" size="sm">Performance</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
