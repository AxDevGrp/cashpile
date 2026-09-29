import Link from "next/link";
import { detectRecurringItems } from "@cashpile/ai";
import { PageHeader } from "@cashpile/ui";
import { getConsumerExperience } from "@/lib/consumer-experience";
import RecurringReviewClient from "./_components/recurring-review-client";
import SubscriptionReviewClient from "./_components/subscription-review-client";

export default async function RecurringCashflowPage() {
  const { userId, enabled } = await getConsumerExperience();
  if (!userId) return null;
  const items = await detectRecurringItems(userId).catch(() => []);

  const confirmedCount = items.filter((i) => i.confirmed || i.source === "manual").length;
  const needsReview = items.length - confirmedCount;
  const subscriptions = items.filter((i) => i.isSubscription && i.included !== false);

  return (
    <div className={enabled ? "px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-6" : "px-6 py-8 max-w-5xl mx-auto space-y-6"}>
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Recurring review"
          description={`Income and bills used by your forecast. ${confirmedCount} confirmed · ${needsReview} need review.`}
        />
        <Link href="/cashflow" className="text-sm underline">← Back</Link>
      </div>
      <RecurringReviewClient items={items} />

      <section id="subscriptions" className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/40">
          <h2 className="text-sm font-semibold">Subscriptions</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Ranked by cost. These are the recurring service charges in your plan — keep what you use, review the rest.
            Nothing here is labeled a leak, and Cashpile never cancels anything for you.
          </p>
        </div>
        <SubscriptionReviewClient items={subscriptions} />
      </section>
    </div>
  );
}