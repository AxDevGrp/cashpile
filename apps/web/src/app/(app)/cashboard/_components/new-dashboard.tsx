import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { getCashflowSnapshot } from "@cashpile/ai";
import UntilPaydayCard from "./until-payday-card";
import UrgentCashRiskCard from "./urgent-cash-risk-card";
import ThisMonthCard from "./this-month-card";
import PriorityCard from "./priority-card";
import OneNextStepCard from "./one-next-step-card";
import NetWorthFooter from "./net-worth-footer";
import { CashInputStrip } from "./cash-input-strip";

const TODAY_LABEL = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default async function NewDashboard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const snapshot = await getCashflowSnapshot(user.id, 30).catch(() => null);
  const { data: actionRows } = await supabase
    .from("cashflow_action_state")
    .select("action_key, pinned, dismissed_at")
    .eq("user_id", user.id);

  const dismissed = new Set(
    (actionRows ?? [])
      .filter((row) => row.action_key.startsWith("next_step:") && row.dismissed_at !== null)
      .map((row) => row.action_key.slice("next_step:".length)),
  );
  const pinned = (actionRows ?? []).some((row) => row.action_key === "priority_pin" && row.pinned);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/assets/gremlin-v3-crop.png" alt="" className="h-10 w-10 rounded-full border border-border" />
          <PageHeaderBlock title="Today" description={TODAY_LABEL} />
        </div>
        <nav aria-label="Cashflow sections" className="flex items-center gap-1.5 text-sm">
          <span aria-current="page" className="rounded-lg bg-primary/10 px-3 py-1.5 font-medium text-primary">Today</span>
          <Link href="/cashflow" className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">Ahead</Link>
          <Link href="/cashflow/what-if" className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">What if?</Link>
          <Link href="/cashflow/recurring" className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">Recurring review</Link>
        </nav>
      </header>

      {snapshot === null ? (
        <section className="glass-card rounded-2xl p-6 space-y-2">
          <h2 className="text-lg font-semibold">Couldn&apos;t load your forecast</h2>
          <p className="text-sm text-muted-foreground">
            Something went wrong calculating your cashflow. Your accounts and transactions are safe — try again in a moment.
          </p>
          <Link href="/cashboard" className="text-sm text-primary underline-offset-2 hover:underline inline-block">Try again →</Link>
        </section>
      ) : snapshot.dataQuality?.accountsIncluded === 0 ? (
        <section className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">No accounts in your plan yet</h2>
          <p className="text-sm text-muted-foreground">
            Connect a bank or add an account, then choose which accounts belong to your personal plan.
            Until then there are no balances to forecast from.
          </p>
          <div className="flex gap-3">
            <Link href="/books/accounts" className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Connect or add an account
            </Link>
            <Link href="/cashflow" className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted">
              Plan accounts
            </Link>
          </div>
        </section>
      ) : (
        <>
          <UntilPaydayCard snapshot={snapshot} />
          <UrgentCashRiskCard snapshot={snapshot} />
          <div className="grid gap-5 md:grid-cols-2">
            <ThisMonthCard margins={snapshot.monthlyMargins ?? []} />
            <div className="space-y-5">
              <PriorityCard cushion={snapshot.emergencyCushion!} pinned={pinned} />
              <OneNextStepCard snapshot={snapshot} dismissed={dismissed} />
            </div>
          </div>
          <NetWorthFooter snapshot={snapshot} />
        </>
      )}

      <CashInputStrip />
    </div>
  );
}

function PageHeaderBlock({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}