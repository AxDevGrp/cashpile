import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { MonthlyMargin } from "@cashpile/ai";

interface Props {
  margins: MonthlyMargin[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ThisMonthCard({ margins }: Props) {
  const current = margins[margins.length - 1];
  const maxAbs = Math.max(...margins.map((m) => Math.abs(m.margin)), 1);
  const comparable = current?.comparableMargin;
  const change = comparable !== undefined && current ? current.margin - comparable : null;

  return (
    <section className="glass-card rounded-2xl p-5" aria-labelledby="this-month-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="this-month-heading" className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
          <BarChart3 className="h-4 w-4" /> This month
        </h2>
        {current && <span className="text-xs text-muted-foreground">through {current.through}</span>}
      </div>

      {current && (
        <p className="mt-2 text-2xl font-bold font-mono">{formatCurrency(current.margin)}</p>
      )}
      {change != null && current && (
        <p className="text-xs mt-0.5 text-muted-foreground">
          {change === 0
            ? `Same as ${monthName(current.month)} through the same day`
            : `${change > 0 ? "Up" : "Down"} ${formatCurrency(Math.abs(change))} vs ${monthName(prevMonthKey(current.month))} through ${current.through.slice(8)}`}
        </p>
      )}
      {current && (current.savingsAllocations > 0 || current.cardPayments > 0) && (
        <p className="text-xs mt-0.5 text-muted-foreground">
          {current.savingsAllocations > 0 && <>Moved to savings: {formatCurrency(current.savingsAllocations)}. </>}
          {current.cardPayments > 0 && <>Card payments: {formatCurrency(current.cardPayments)} (not counted as spending — purchases are).</>}
        </p>
      )}

      <div className="mt-4 flex items-end gap-2 h-24" role="img" aria-label={barsLabel(margins)}>
        {margins.map((m) => {
          const height = Math.max(2, (Math.abs(m.margin) / maxAbs) * 100);
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className={`w-full rounded-t ${
                  m.margin >= 0 ? "bg-emerald-500" : "bg-red-500"
                } ${m.partialMonth ? "border-2 border-dashed border-current/60" : ""}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {margins.map((m) => (
          <div key={m.month} className="flex-1 text-center">
            <div className="text-[11px] text-muted-foreground">{monthName(m.month)}</div>
            <div className={`text-[11px] font-mono ${m.margin < 0 ? "text-red-600" : "text-foreground"}`}>
              {formatCurrency(m.margin)}
              {m.partialMonth ? "*" : ""}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        * Measured to date — not compared with full past months. Solid = complete month, dashed border = current month so far.
      </p>
      <Link href="/books/transactions" className="text-sm mt-2 inline-block text-primary underline-offset-2 hover:underline">
        See transactions →
      </Link>
    </section>
  );
}

function monthName(monthKey: string): string {
  return MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;
}

function prevMonthKey(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, "0")}`;
}

function barsLabel(margins: MonthlyMargin[]): string {
  return `Monthly margin, oldest to newest: ${margins
    .map((m) => `${monthName(m.month)} ${formatCurrency(m.margin)}${m.partialMonth ? " through " + m.through : ""}`)
    .join(", ")}.`;
}