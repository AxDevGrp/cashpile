import { TrendingUp, Plus } from "lucide-react";
import { PageHeader } from "@cashpile/ui";
import Link from "next/link";

export default function TradesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Trades"
        description="Prop firm account tracking and performance analytics"
        actions={
          <Link href="/trades/accounts" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" /> Add account
          </Link>
        }
      />
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="h-7 w-7 text-blue-600" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No prop firm accounts yet</h3>
        <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
          Add your first funded account to start tracking drawdown, logging trades, and analyzing performance.
        </p>
        <Link href="/trades/accounts" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add your first account
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/trades/accounts", label: "Accounts", desc: "Prop firm accounts & funded rules" },
          { href: "/trades/journal", label: "Trade Journal", desc: "Log and review every trade" },
          { href: "/trades/metrics", label: "Metrics", desc: "Win rate, profit factor, Sharpe" },
          { href: "/trades/performance", label: "Performance", desc: "Equity curve & session analysis" },
        ].map(({ href, label, desc }) => (
          <Link key={href} href={href} className="bg-background rounded-xl border p-4 hover:border-blue-500/40 transition-colors">
            <div className="font-medium text-sm mb-1">{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
