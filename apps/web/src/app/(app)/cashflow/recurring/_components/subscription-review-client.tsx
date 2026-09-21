"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, Eye, X } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { RecurringCadence, RecurringItem } from "@cashpile/ai";
import { setSubscriptionReview } from "../actions";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  keep: { label: "Keeping — worth it", className: "bg-emerald-100 text-emerald-700" },
  review: { label: "You'll look into it", className: "bg-blue-100 text-blue-700" },
  cancel_help: { label: "You reported cancelling (not verified by Cashpile)", className: "bg-amber-100 text-amber-800" },
};

function monthlyEquivalent(amount: number, cadence: RecurringCadence): number {
  switch (cadence) {
    case "weekly": return (amount * 52) / 12;
    case "biweekly": return (amount * 26) / 12;
    case "twice_monthly": return amount * 2;
    case "monthly": return amount;
    case "quarterly": return amount / 3;
    case "annual": return amount / 12;
    default: return 0;
  }
}

export default function SubscriptionReviewClient({ items }: { items: RecurringItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const ranked = [...items].sort((a, b) =>
    monthlyEquivalent(b.averageAmount, b.cadence) - monthlyEquivalent(a.averageAmount, a.cadence),
  );

  function review(item: RecurringItem, status: "keep" | "review" | "cancel_help") {
    startTransition(async () => {
      try {
        await setSubscriptionReview({
          id: item.confirmed || item.source === "manual" ? item.id : undefined,
          proposal: item.confirmed || item.source === "manual" ? undefined : item,
          status,
        });
        toast.success("Saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save your review");
      }
    });
  }

  if (!ranked.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No subscription-like charges detected yet. Detected recurring service charges will show up here for review.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {ranked.map((item) => {
        const monthly = monthlyEquivalent(item.averageAmount, item.cadence);
        const annual = monthly * 12;
        const badge = item.reviewStatus ? STATUS_BADGES[item.reviewStatus] : null;
        const reviewed = !!item.reviewStatus;
        return (
          <div key={item.id} className="p-4 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <div className="font-medium flex flex-wrap items-center gap-2">
                  {item.merchant}
                  {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>}
                  {!reviewed && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Suggested by detection</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.cadence.replace("_", " ")} · next expected {item.nextExpectedDate}
                </div>
              </div>
              <div className="font-mono text-sm">
                <span>{formatCurrency(monthly)}/mo</span>
                <span className="text-muted-foreground"> · {formatCurrency(annual)}/yr</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => review(item, "keep")}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${reviewed && item.reviewStatus === "keep" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border hover:bg-muted"}`}
                  title="You use it and it's worth the cost"
                >
                  <Check className="h-3.5 w-3.5" /> Keep
                </button>
                <button
                  onClick={() => review(item, "review")}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${reviewed && item.reviewStatus === "review" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-border hover:bg-muted"}`}
                  title="You'll decide later"
                >
                  <Eye className="h-3.5 w-3.5" /> Review
                </button>
                <button
                  onClick={() => review(item, "cancel_help")}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${reviewed && item.reviewStatus === "cancel_help" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border hover:bg-muted"}`}
                  title="Help with cancelling — you do the cancelling, not Cashpile"
                >
                  <X className="h-3.5 w-3.5" /> Cancellation help
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {item.cadence === "annual"
                ? `Annual plan — cancelling before the ~${item.nextExpectedDate} renewal saves ${formatCurrency(annual)}/yr, but frees no monthly cash now.`
                : `Cancelling would free about ${formatCurrency(monthly)}/mo (${formatCurrency(annual)}/yr).`}
              {item.reviewStatus === "cancel_help" && " Cashpile has not cancelled anything and cannot verify the cancellation — that report comes from you."}
            </p>
          </div>
        );
      })}
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Costs come from your detected history. Cashpile never assumes a subscription is unused or a leak — only you
        know what you use. <ExternalLink className="inline h-3 w-3" /> Cancellations happen at the merchant, never here.
      </p>
    </div>
  );
}