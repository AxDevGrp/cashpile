import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { EmergencyCushion } from "@cashpile/ai";
import PinButton from "./pin-button";

interface Props {
  cushion: EmergencyCushion;
  pinned: boolean;
}

export default function PriorityCard({ cushion, pinned }: Props) {
  const progress = cushion.months != null && cushion.targetMonths
    ? Math.min(100, Math.round((cushion.months / cushion.targetMonths) * 100))
    : null;

  return (
    <section className="glass-card rounded-2xl p-5" aria-labelledby="priority-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="priority-heading" className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Your priority
        </h2>
        <PinButton pinned={pinned} />
      </div>

      {pinned && <p className="text-[11px] text-muted-foreground mt-1">Pinned as your priority — Cashpile will not swap it for a scarier-looking number.</p>}

      {cushion.reserveBalance <= 0 ? (
        <div className="mt-3">
          <p className="text-lg font-semibold">No emergency reserve set</p>
          <p className="text-sm text-muted-foreground mt-1">
            Mark a savings account as your emergency fund to start measuring your cushion.
          </p>
          <Link href="/cashflow" className="text-sm mt-2 inline-block text-primary underline-offset-2 hover:underline">
            Designate a reserve →
          </Link>
        </div>
      ) : cushion.months == null ? (
        <div className="mt-3">
          <p className="text-lg font-semibold">{formatCurrency(cushion.reserveBalance)} saved</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cushion months are unknown until essentials are measurable — set your everyday spending allowance.
          </p>
          <Link href="/settings" className="text-sm mt-2 inline-block text-primary underline-offset-2 hover:underline">
            Set your allowance →
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-2xl font-bold font-mono">
            {cushion.months.toFixed(1)} {cushion.months === 1 ? "month" : "months"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCurrency(cushion.reserveBalance)} covering {formatCurrency(cushion.essentialMonthlyOutflows ?? 0)} of monthly essentials
            {cushion.estimated ? " (estimated until your allowance is confirmed)" : ""}
          </p>
          {progress != null && (
            <div className="mt-3" role="img" aria-label={`You are at ${progress}% of your ${cushion.targetMonths}-month target cushion.`}>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{progress}% of your {cushion.targetMonths}-month target</p>
            </div>
          )}
          {cushion.targetMonths == null && (
            <Link href="/settings" className="text-xs mt-2 inline-block text-primary underline-offset-2 hover:underline">
              Set a target cushion →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}