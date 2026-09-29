/**
 * Pure consumer presentation choices (Stage 06).
 *
 * Fixed hrefs, metric-param routing, and value formatting only. No financial
 * math beyond formatting (divide cents by 100 exactly once).
 */

export const CONSUMER_METRIC_IDS = [
  "available",
  "passive-income",
  "debt",
  "cushion",
  "net-worth",
] as const;

export type ConsumerMetricId = (typeof CONSUMER_METRIC_IDS)[number];

/** Tile hrefs fixed by contracts.md §1 / §5. */
export const CONSUMER_METRIC_HREFS: Record<ConsumerMetricId, string> = {
  available: "/cashflow?view=details",
  "passive-income": "/cashboard?metric=passive-income",
  debt: "/cashboard?metric=debt",
  cushion: "/cashboard?metric=cushion",
  "net-worth": "/cashboard?metric=net-worth",
};

export type MetricTone = "positive" | "negative" | "neutral" | "unavailable";

export interface MetricView {
  id: ConsumerMetricId;
  value: number | null;
  unit: "USD_cents" | "months";
  quality: "estimated" | "available" | "unavailable";
}

export function isConsumerMetricId(value: string | null | undefined): value is ConsumerMetricId {
  return typeof value === "string" && (CONSUMER_METRIC_IDS as readonly string[]).includes(value);
}

/** Unknown/invalid metric falls back to null (home). */
export function resolveMetricParam(value: string | null | undefined): ConsumerMetricId | null {
  return isConsumerMetricId(value) ? value : null;
}

export function formatMoneyCents(
  cents: number | null | undefined,
  formatCurrency: (dollars: number) => string
): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return formatCurrency(cents / 100);
}

export function formatMonths(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

/** Null renders an em dash; a real zero renders as zero. Cushion keeps one decimal. */
export function formatMetricValue(
  metric: Pick<MetricView, "value" | "unit">,
  formatCurrency: (dollars: number) => string
): string {
  return metric.unit === "months"
    ? formatMonths(metric.value)
    : formatMoneyCents(metric.value, formatCurrency);
}

/** Available positive is lime; negative is a shortfall; unavailable is neutral. */
export function metricTone(metric: Pick<MetricView, "id" | "value" | "quality">): MetricTone {
  if (metric.quality === "unavailable" || metric.value === null || !Number.isFinite(metric.value)) {
    return "unavailable";
  }
  if (metric.id === "available") return metric.value < 0 ? "negative" : "positive";
  return "neutral";
}

/** Absolute shortfall in cents when available is negative, else null. */
export function availableShortfallCents(
  metric: Pick<MetricView, "id" | "value">
): number | null {
  if (metric.id !== "available" || metric.value === null || metric.value >= 0) return null;
  return -metric.value;
}

/** User-scoped key so one user's review progress is never visible to another. */
export function consumerReviewSkipKey(userId: string): string {
  return `cashpile-consumer-review-skipped:${userId}`;
}

export function clearConsumerReviewStorage(removeItem: (key: string) => void, userId: string): void {
  removeItem(consumerReviewSkipKey(userId));
}
