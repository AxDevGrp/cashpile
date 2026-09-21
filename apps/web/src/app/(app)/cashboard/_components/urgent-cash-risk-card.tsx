import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { CashflowSnapshot } from "@cashpile/ai";

interface Props {
  snapshot: CashflowSnapshot;
}

export default function UrgentCashRiskCard({ snapshot }: Props) {
  const risk = snapshot.cashRisk;
  if (!risk) return null;

  const shortfall = risk.shortfall > 0;
  const belowBuffer = risk.firstBelowBufferDate && risk.firstBelowBufferDate !== risk.firstNegativeDate;
  if (!shortfall && !belowBuffer) return null;

  const date = risk.firstNegativeDate ?? risk.firstBelowBufferDate ?? risk.lowDate;

  return (
    <section
      aria-labelledby="cash-risk-heading"
      className={`rounded-2xl border p-4 ${shortfall ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
    >
      <h2 id="cash-risk-heading" className="text-sm font-semibold flex items-center gap-1.5 text-red-800">
        <AlertTriangle className="h-4 w-4" />
        {shortfall ? `Projected shortfall: ${formatCurrency(risk.shortfall)}` : "Cutting it close to your buffer"}
      </h2>
      <p className="text-sm mt-1 text-red-900/80">
        {shortfall
          ? `Your projected balance goes negative on ${date}.`
          : `Your projected balance dips below your ${formatCurrency(risk.minimumBuffer)} buffer on ${risk.firstBelowBufferDate}.`}
      </p>
      {risk.causes.length > 0 && (
        <p className="text-xs mt-1 text-red-900/70">
          Driven by: {risk.causes.map((c) => `${c.label} ${formatCurrency(c.amount)} on ${c.date}`).join(", ")}
        </p>
      )}
      <Link href="/cashflow" className="text-sm mt-2 inline-block font-medium text-red-800 underline-offset-2 hover:underline">
        Review the next 30 days →
      </Link>
    </section>
  );
}