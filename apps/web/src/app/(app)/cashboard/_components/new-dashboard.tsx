import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { getCashboardSnapshot } from "@cashpile/ai";
import { CONSUMER_METRIC_IDS } from "@/components/ui-v2/consumer-model";
import OneNextStepCard from "./one-next-step-card";
import { CashInputStrip } from "./cash-input-strip";
import { MetricTile } from "./metric-tile";
import styles from "./consumer-dashboard.module.css";

const TODAY_LABEL = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default async function NewDashboard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const snapshot = await getCashboardSnapshot(user.id).catch(() => null);
  const { data: actionRows } = await supabase
    .from("cashflow_action_state")
    .select("action_key, pinned, dismissed_at")
    .eq("user_id", user.id);

  const dismissed = new Set(
    (actionRows ?? [])
      .filter((row) => row.action_key.startsWith("next_step:") && row.dismissed_at !== null)
      .map((row) => row.action_key.slice("next_step:".length)),
  );

  const header = (
    <header className="flex items-center gap-3">
      <img src="/assets/gremlin-v3-crop.png" alt="" className="h-10 w-10 rounded-full" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">{TODAY_LABEL}</p>
      </div>
    </header>
  );

  if (snapshot === null) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
        {header}
        <section className="rounded-2xl p-6 space-y-2" style={{ background: "var(--cp-surface, #252b34)" }}>
          <h2 className="text-lg font-semibold">Couldn&apos;t load your forecast</h2>
          <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            Something went wrong calculating your cashflow. Your accounts and transactions are safe — try again in a moment.
          </p>
          <Link href="/cashboard" className="text-sm underline">Try again →</Link>
        </section>
        <CashInputStrip />
      </div>
    );
  }

  if (snapshot.cashflow.dataQuality?.accountsIncluded === 0) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
        {header}
        <section className="rounded-2xl p-6 space-y-3" style={{ background: "var(--cp-surface, #252b34)" }}>
          <h2 className="text-lg font-semibold">No accounts in your plan yet</h2>
          <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            Connect a bank or add an account, then confirm which accounts belong to your personal plan.
          </p>
          <div className="flex gap-3">
            <Link href="/books/accounts" className="rounded-lg px-4 py-1.5 text-sm font-medium" style={{ background: "var(--cp-lime, #c7f65a)", color: "var(--cp-on-lime, #11180a)" }}>
              Connect or add an account
            </Link>
            <Link href="/settings" className="rounded-lg border px-4 py-1.5 text-sm font-medium" style={{ borderColor: "var(--cp-border, #46515f)" }}>
              Settings
            </Link>
          </div>
        </section>
        <CashInputStrip />
      </div>
    );
  }

  const metrics = snapshot.metrics;
  const secondary = CONSUMER_METRIC_IDS.filter((id) => id !== "available");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      {header}
      <CashInputStrip />

      <MetricTile metric={metrics.available} prominent />

      <div className={styles.grid}>
        {secondary.map((id) => (
          <MetricTile key={id} metric={metrics[id]} />
        ))}
      </div>

      {snapshot.warnings.length > 0 ? (
        <ul className="text-xs space-y-1" style={{ color: "var(--cp-attention, #f3c76a)" }}>
          {snapshot.warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {snapshot.review.count > 0 ? (
        <section className="rounded-2xl p-4 flex items-center justify-between gap-3" style={{ background: "var(--cp-surface, #252b34)" }}>
          <span className="text-sm">
            {snapshot.review.count} transaction{snapshot.review.count === 1 ? "" : "s"} need a quick look
          </span>
          <Link href="/books/transactions/ai-review" className="text-sm underline">
            Review →
          </Link>
        </section>
      ) : null}

      <OneNextStepCard snapshot={snapshot.cashflow} dismissed={dismissed} />
    </div>
  );
}
