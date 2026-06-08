import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { detectRecurringItems } from "@cashpile/ai";
import { formatCurrency, PageHeader } from "@cashpile/ui";

export default async function RecurringCashflowPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const items = await detectRecurringItems(user.id).catch(() => []);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Recurring cash flow" description="Detected recurring income and bills used by Cash Flow Copilot." />
        <Link href="/cashflow" className="text-sm text-primary">← Back</Link>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No recurring items confidently detected yet. More transaction history will improve detection.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="p-4 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                <div>
                  <div className="font-medium">{item.merchant}</div>
                  <div className="text-xs text-muted-foreground">{item.cadence} · next expected {item.nextExpectedDate}</div>
                </div>
                <div className={`font-mono text-sm ${item.direction === "income" ? "text-emerald-500" : "text-red-500"}`}>
                  {item.direction === "income" ? "+" : "-"}{formatCurrency(item.averageAmount)}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{item.direction}</div>
                <div className="text-xs text-muted-foreground">{Math.round(item.confidence * 100)}% confidence</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        MVP note: this screen is review-only. Editing cadence, inclusion, and next dates should be the next iteration after validating the affordability workflow.
      </p>
    </div>
  );
}
