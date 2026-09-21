import Link from "next/link";
import { AlertTriangle, CalendarDays, ShieldCheck } from "lucide-react";
import { createServerSupabaseClient } from "@cashpile/db";
import { formatCurrency, PageHeader } from "@cashpile/ui";
import { getCashflowSnapshot } from "@cashpile/ai";
import { AffordabilityForm } from "@/components/cashflow/affordability-form";
import { ModuleHomeV2 } from "../_components/module-home-v2";
import { isUiV2Enabled } from "@/components/ui-v2";
import { shouldRenderModuleEntrance } from "@/components/ui-v2/module-home-model";

export default async function CashflowPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const snapshot = await getCashflowSnapshot(user.id, 30).catch(() => null);
  const resolvedSearchParams = await searchParams;
  const insight = !snapshot
    ? { id: "connect", severity: "info" as const, title: "Connect accounts", detail: "Sync transactions to start planning cash flow.", actionLabel: "Open detailed workspace" }
    : snapshot.safeToSpend <= 0
      ? { id: "safe-to-spend", severity: "critical" as const, title: "Cash is tight", detail: "Review upcoming bills before extra spending.", actionLabel: "Check affordability" }
      : { id: "safe-to-spend", severity: "info" as const, title: `${formatCurrency(snapshot.safeToSpend)} is safe to spend`, detail: "This estimate accounts for upcoming bills and your buffer.", actionLabel: "Check affordability" };

  if (shouldRenderModuleEntrance(isUiV2Enabled(), resolvedSearchParams?.view)) return <ModuleHomeV2 id="cashflow" insight={insight} actionHref="/cashflow?view=details" />;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Cash Flow Copilot"
        description="Ask Cashpile if you can afford a purchase before it becomes a cash-flow problem."
      />

      {!snapshot ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
          Connect accounts and sync transactions to start using Cash Flow Copilot.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><ShieldCheck className="h-4 w-4" /> Safe to spend</div>
              <div className="text-3xl font-bold font-mono">{formatCurrency(snapshot.safeToSpend)}</div>
              <p className="text-xs text-muted-foreground mt-1">After upcoming bills and your buffer.</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><AlertTriangle className="h-4 w-4" /> Projected low</div>
              <div className="text-3xl font-bold font-mono">{formatCurrency(snapshot.forecast.projectedLowBalance)}</div>
              <p className="text-xs text-muted-foreground mt-1">Lowest projected balance in 30 days.</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><CalendarDays className="h-4 w-4" /> Next income</div>
              <div className="text-3xl font-bold font-mono">{snapshot.nextIncomeDate ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Based on recurring income detection.</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-4">
            <AffordabilityForm />
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Upcoming obligations</h2>
                  <Link href="/cashflow/recurring" className="text-xs text-primary">Review recurring →</Link>
                </div>
                {snapshot.forecast.upcomingExpenses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recurring bills confidently detected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {snapshot.forecast.upcomingExpenses.slice(0, 8).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{item.label}</span>
                        <span className="shrink-0 font-mono text-red-500">{item.date} · {formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-sm font-semibold mb-3">Assumptions</h2>
                <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                  {snapshot.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
