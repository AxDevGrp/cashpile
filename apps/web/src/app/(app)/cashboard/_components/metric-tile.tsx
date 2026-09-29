import Link from "next/link";
import { formatCurrency } from "@cashpile/ui";
import {
  CONSUMER_METRIC_HREFS,
  formatMetricValue,
  metricTone,
  type ConsumerMetricId,
} from "@/components/ui-v2/consumer-model";
import styles from "./consumer-dashboard.module.css";

export interface TileMetric {
  id: ConsumerMetricId;
  value: number | null;
  unit: "USD_cents" | "months";
  quality: "estimated" | "available" | "unavailable";
  reasons: string[];
}

export const METRIC_LABELS: Record<ConsumerMetricId, string> = {
  available: "Available before payday",
  "passive-income": "Identified this month",
  debt: "Debt",
  cushion: "Emergency cushion",
  "net-worth": "Net worth",
};

/** A single metric tile. Null/unavailable renders an em dash, never a zero. */
export function MetricTile({ metric, prominent = false }: { metric: TileMetric; prominent?: boolean }) {
  const tone = metricTone(metric);
  const value = formatMetricValue(metric, formatCurrency);
  const shortfall = tone === "negative";

  return (
    <Link
      href={CONSUMER_METRIC_HREFS[metric.id]}
      className={`${styles.tile} ${prominent ? styles.tileProminent : ""} ${styles[`tone_${tone}`] ?? ""}`}
    >
      <span className={styles.tileLabel}>{METRIC_LABELS[metric.id]}</span>
      <span className={`${styles.tileValue} ${shortfall ? styles.tileDanger : ""}`}>
        {shortfall ? `Shortfall ${value.replace("-", "")}` : value}
      </span>
      {metric.quality === "estimated" ? <span className={styles.tileBadge}>Estimate</span> : null}
      {metric.quality === "unavailable" ? (
        <span className={styles.tileReason}>
          {metric.reasons[0] ? metric.reasons[0].replace(/_/g, " ") : "Unavailable"}
        </span>
      ) : null}
    </Link>
  );
}
