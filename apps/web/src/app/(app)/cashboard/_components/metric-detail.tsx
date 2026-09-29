import Link from "next/link";
import { formatCurrency } from "@cashpile/ui";
import { formatMetricValue } from "@/components/ui-v2/consumer-model";
import { METRIC_LABELS, type TileMetric } from "./metric-tile";
import styles from "./consumer-dashboard.module.css";

/** Drill-in for one metric. Hrefs come from the server contract; no charts. */
export function MetricDetail({ metric }: { metric: TileMetric }) {
  const value = formatMetricValue(metric, formatCurrency);
  const period = (metric as { period?: { from: string; through: string } | null }).period;
  const asOf = (metric as { asOf?: string | null }).asOf;
  const rows = (metric as { rows?: Array<{ id: string; label: string; value: number | null }> }).rows ?? [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-5">
      <Link href="/cashboard" className={styles.backLink}>
        ← Back
      </Link>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{METRIC_LABELS[metric.id]}</h1>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {period ? (
          <p className="text-xs text-muted-foreground">
            {period.from} → {period.through}
          </p>
        ) : null}
        {asOf ? <p className="text-xs text-muted-foreground">As of {asOf}</p> : null}
      </header>

      {metric.quality === "unavailable" ? (
        <section className={styles.unavailable}>
          <h2 className="text-sm font-semibold">Not enough information yet</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {metric.reasons.map((reason) => (
              <li key={reason}>{reason.replace(/_/g, " ")}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/books/accounts" className="underline">
              Accounts
            </Link>
            <Link href="/settings" className="underline">
              Settings
            </Link>
          </div>
        </section>
      ) : (
        <section>
          <h2 className="text-sm font-semibold mb-2">Evidence</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence rows available.</p>
          ) : (
            <ul className={styles.evidenceList}>
              {rows.map((row) => (
                <li key={row.id} className={styles.evidenceRow}>
                  <span className="truncate">{row.label}</span>
                  <span className="tabular-nums">
                    {row.value == null ? "—" : formatCurrency(row.value / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {metric.id === "passive-income" ? (
        <p className={styles.disclaimer}>
          Cash receipts, before related expenses/taxes. Identified this month — not a guaranteed figure.
        </p>
      ) : null}
      {metric.id === "cushion" ? (
        <p className={styles.disclaimer}>
          Estimated monthly commitments. Set your essential allowance in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      ) : null}
      {metric.reasons.length && metric.quality !== "unavailable" ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5">
          {metric.reasons.map((reason) => (
            <li key={reason}>{reason.replace(/_/g, " ")}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
