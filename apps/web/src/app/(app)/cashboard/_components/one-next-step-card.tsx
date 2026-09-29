import Link from "next/link";
import { Sparkles } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import { monthlyEquivalentCents } from "@cashpile/ai";
import type { CashflowSnapshot } from "@cashpile/ai";
import DismissButton from "./dismiss-button";

interface Props {
  snapshot: CashflowSnapshot;
  dismissed: Set<string>;
}

interface NextStep {
  key: string;
  title: string;
  observation: string;
  impact: string;
  actionLabel: string;
  actionHref: string;
}

function buildNextStep(snapshot: CashflowSnapshot, dismissed: Set<string>): NextStep {
  const candidates: NextStep[] = [];

  if (snapshot.cashRisk && snapshot.cashRisk.shortfall > 0) {
    const date = snapshot.cashRisk.firstNegativeDate ?? snapshot.cashRisk.lowDate;
    candidates.push({
      key: `cash_risk:${Math.round(snapshot.cashRisk.shortfall)}:${date}`,
      title: "Cover the projected shortfall",
      observation: `Your balance is projected to go negative by ${formatCurrency(snapshot.cashRisk.shortfall)} around ${date}.`,
      impact: "Avoid overdraft fees by moving money in or shifting a payment before then.",
      actionLabel: "Review the 30-day forecast",
      actionHref: "/cashflow",
    });
  }

  const subscriptionCandidates = snapshot.recurringItems
    .filter((i) => i.isSubscription && i.included !== false && !i.reviewStatus)
    .map((i) => ({ item: i, monthlyCents: monthlyEquivalentCents(Math.round(i.averageAmount * 100), i.cadence) }))
    .sort((a, b) => b.monthlyCents - a.monthlyCents);
  if (subscriptionCandidates.length > 0) {
    const { item, monthlyCents } = subscriptionCandidates[0];
    const annual = (monthlyCents / 100) * 12;
    candidates.push({
      key: `subscription_review:${item.id}:${monthlyCents}`,
      title: `Review your biggest subscription — ${item.merchant}`,
      observation: `${item.merchant} costs about ${formatCurrency(monthlyCents / 100)}/mo (${formatCurrency(annual)}/yr) based on your history.`,
      impact: "Only you can decide if it's worth keeping — Cashpile never assumes it's unused or a leak.",
      actionLabel: "Review subscriptions",
      actionHref: "/cashflow/recurring#subscriptions",
    });
  }

  const unconfirmed = snapshot.recurringItems.filter((i) => !i.confirmed && i.source !== "manual");
  if (unconfirmed.length > 0) {
    candidates.push({
      key: `confirm_recurring:${unconfirmed.length}`,
      title: `Confirm ${unconfirmed.length} detected ${unconfirmed.length === 1 ? "item" : "items"}`,
      observation: `${unconfirmed.length} recurring ${unconfirmed.length === 1 ? "bill or payday is" : "bills and paydays are"} still educated guesses from your history.`,
      impact: "Confirmed items sharpen the payday estimate; it stays an estimate, never a guarantee.",
      actionLabel: "Review recurring",
      actionHref: "/cashflow/recurring",
    });
  }

  if (snapshot.dataQuality?.missingInputs.includes("essential_allowance")) {
    candidates.push({
      key: "set_allowance:",
      title: "Set your everyday spending allowance",
      observation: "Groceries, gas, and similar essentials are missing from the forecast.",
      impact: "Until payday stops overstating what you can spend on top of everyday life.",
      actionLabel: "Set allowance",
      actionHref: "/settings",
    });
  }

  if (snapshot.emergencyCushion && snapshot.emergencyCushion.reserveBalance <= 0) {
    candidates.push({
      key: "set_reserve:",
      title: "Designate an emergency reserve",
      observation: "No savings account is marked as your emergency fund yet.",
      impact: "Your cushion becomes measurable and can grow toward a target.",
      actionLabel: "Pick a reserve account",
      actionHref: "/cashflow",
    });
  }

  if (snapshot.emergencyCushion && snapshot.emergencyCushion.reserveBalance > 0 && snapshot.emergencyCushion.targetMonths == null) {
    candidates.push({
      key: "set_target:",
      title: "Set a cushion target",
      observation: `You have ${formatCurrency(snapshot.emergencyCushion.reserveBalance)} saved but no target to measure progress against.`,
      impact: "Cashpile can tell you how far along your cushion is.",
      actionLabel: "Set target months",
      actionHref: "/settings",
    });
  }

  const first = candidates.find((c) => !dismissed.has(c.key));
  if (first) return first;
  return {
    key: "none:",
    title: "No action needed",
    observation: "Your plan looks steady through the next 30 days.",
    impact: "Check back after your next account sync.",
    actionLabel: "",
    actionHref: "",
  };
}

export default function OneNextStepCard({ snapshot, dismissed }: Props) {
  const step = buildNextStep(snapshot, dismissed);

  return (
    <section className="glass-card rounded-2xl p-5" aria-labelledby="next-step-heading">
      <h2 id="next-step-heading" className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-4 w-4" /> One next step
      </h2>
      <p className="mt-2 text-lg font-semibold">{step.title}</p>
      <p className="text-sm text-muted-foreground mt-1">{step.observation}</p>
      <p className="text-xs text-muted-foreground mt-0.5">Why it matters: {step.impact}</p>
      <div className="mt-3 flex items-center gap-3">
        {step.actionLabel && (
          <Link
            href={step.actionHref}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {step.actionLabel}
          </Link>
        )}
        {!step.key.startsWith("none") && <DismissButton ruleKey={step.key} />}
      </div>
    </section>
  );
}