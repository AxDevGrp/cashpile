import Link from "next/link";
import { formatCurrency } from "@cashpile/ui";
import { getCashboardSnapshot } from "@cashpile/ai";
import { formatMetricValue } from "@/components/ui-v2/consumer-model";

/** Screen 2 — consumer spending detail. Loads the snapshot once, server-side. */
export default async function ConsumerSpendingDetail({ userId }: { userId: string }) {
  const snapshot = await getCashboardSnapshot(userId).catch(() => null);

  if (!snapshot) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-4">
        <BackLink />
        <section className="rounded-2xl p-6" style={{ background: "var(--cp-surface, #252b34)" }}>
          <h1 className="text-lg font-semibold">Couldn&apos;t load your spending detail</h1>
          <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            Your accounts are safe — try again in a moment.
          </p>
        </section>
      </div>
    );
  }

  const metric = snapshot.metrics.available;
  const forecast = snapshot.cashflow.forecast;
  const risk = snapshot.cashflow.cashRisk;
  const value = formatMetricValue(metric, formatCurrency);
  const period = metric.period;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-6">
      <BackLink />

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Available before payday</h1>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {period ? (
          <p className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            {period.from} → {period.through}
          </p>
        ) : null}
        {metric.asOf ? (
          <p className="text-xs" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            Estimate as of {metric.asOf} · {metric.reasons.join(", ").replace(/_/g, " ")}
          </p>
        ) : null}
      </header>

      <section>
        <h2 className="text-sm font-semibold mb-2">Breakdown</h2>
        <ul className="space-y-1 text-sm">
          {metric.rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 border-b py-1" style={{ borderColor: "var(--cp-border, #46515f)" }}>
              <span className="truncate">{row.label}</span>
              <span className="tabular-nums">{row.value == null ? "—" : formatCurrency(row.value / 100)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Projection</h2>
        <p className="text-sm">
          Projected low {formatCurrency(risk?.lowBalance ?? forecast.projectedLowBalance)} on {risk?.lowDate ?? forecast.projectedLowDate ?? "—"} against a{" "}
          {formatCurrency(snapshot.cashflow.minimumBuffer)} buffer.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">View daily balances</summary>
          <table className="mt-2 w-full text-left tabular-nums">
            <thead>
              <tr>
                <th>Date</th>
                <th>Projected</th>
              </tr>
            </thead>
            <tbody>
              {forecast.dailyBalances.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td>{formatCurrency(day.projectedBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Upcoming bills</h2>
          <Link href="/cashflow/recurring" className="text-xs underline">
            Review recurring →
          </Link>
        </div>
        {forecast.upcomingExpenses.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
            No recurring bills confidently detected yet.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {forecast.upcomingExpenses.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums">
                  {item.date} · {formatCurrency(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/cashflow/what-if"
        className="inline-block rounded-lg px-4 py-2 text-sm font-medium"
        style={{ background: "var(--cp-lime, #c7f65a)", color: "var(--cp-on-lime, #11180a)" }}
      >
        Preview a change
      </Link>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/cashboard" className="text-sm" style={{ color: "var(--cp-muted, #b8c0cc)" }}>
      ← Cashboard
    </Link>
  );
}
