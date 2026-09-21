import Link from "next/link";
import { formatCurrency } from "@cashpile/ui";
import type { CashflowSnapshot } from "@cashpile/ai";

interface Props {
  snapshot: CashflowSnapshot;
}

export default function NetWorthFooter({ snapshot }: Props) {
  const netWorth = snapshot.netWorth;
  if (!netWorth) return null;
  const dq = snapshot.dataQuality;

  return (
    <footer className="glass-card rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <div>
        <span className="font-medium text-foreground">Net worth {formatCurrency(netWorth.net)}</span>
        <span className="text-xs"> · {formatCurrency(netWorth.assets)} assets − {formatCurrency(netWorth.liabilities)} debts</span>
        {dq?.balanceAsOf && <span className="text-xs"> · balances as of {dq.balanceAsOf.slice(0, 10)}</span>}
        {netWorth.accountsMissingBalance > 0 && (
          <span className="text-xs"> · {netWorth.accountsMissingBalance} accounts with unknown balances excluded</span>
        )}
      </div>
      <Link href="/cashflow" className="text-xs text-primary underline-offset-2 hover:underline">
        See composition →
      </Link>
    </footer>
  );
}