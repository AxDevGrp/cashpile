import { z } from "zod";
import type { CashboardMetricId, CashboardSnapshot } from "@cashpile/ai";

export const CASHBOARD_METRIC_IDS = [
  "available",
  "passive-income",
  "debt",
  "cushion",
  "net-worth",
] as const satisfies readonly CashboardMetricId[];

export const SUMMARY_CAPABILITIES = new Set(["cashboard.summary.get", "cashboard.metric.explain"]);

export function isConsumerAgentCapability(name: string): boolean {
  return SUMMARY_CAPABILITIES.has(name);
}

const summaryInputSchema = z.object({}).strict();
const metricExplainInputSchema = z
  .object({ metricId: z.enum(CASHBOARD_METRIC_IDS) })
  .strict();

export function validateSummaryInput(input: unknown): Record<string, never> | null {
  const parsed = summaryInputSchema.safeParse(input ?? {});
  return parsed.success ? (parsed.data as Record<string, never>) : null;
}

export function validateMetricExplainInput(input: unknown): { metricId: CashboardMetricId } | null {
  const parsed = metricExplainInputSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Aggregate metric shape: rows and all transactional evidence removed. */
export interface ConsumerMetricSummary {
  id: CashboardMetricId;
  value: number | null;
  unit: "USD_cents" | "months";
  quality: "estimated" | "available" | "unavailable";
  period: { from: string; through: string } | null;
  asOf: string | null;
  reasons: string[];
}

export interface ConsumerSummary {
  version: 1;
  currency: "USD";
  asOf: string;
  metrics: Record<CashboardMetricId, ConsumerMetricSummary>;
  unresolvedCount: number;
}

export function toConsumerSummary(snapshot: CashboardSnapshot): ConsumerSummary {
  const metrics = {} as Record<CashboardMetricId, ConsumerMetricSummary>;
  for (const id of CASHBOARD_METRIC_IDS) {
    const metric = snapshot.metrics[id];
    metrics[id] = {
      id: metric.id,
      value: metric.value,
      unit: metric.unit,
      quality: metric.quality,
      period: metric.period,
      asOf: metric.asOf,
      reasons: metric.reasons,
    };
  }
  return {
    version: 1,
    currency: "USD",
    asOf: snapshot.asOf,
    metrics,
    unresolvedCount: snapshot.review.count,
  };
}

type MetricDefinition = { definition: string; assumptions: string[] };

/** Deterministic wording from contracts.md; never model-generated. */
export const METRIC_DEFINITIONS: Record<CashboardMetricId, MetricDefinition> = {
  available: {
    definition:
      "Cash available until the day before your next confirmed payday, after setting aside your buffer. A negative value is shown as a projected shortfall.",
    assumptions: [
      "Uses the provider available balance when known, otherwise the current balance.",
      "If only the current balance is known and pending debits exist, the amount is unavailable rather than guessed.",
      "If no payday is confirmed the window is the next 14 calendar days, and an inferred payday is labelled provisional.",
      "The buffer defaults to the larger of $250 or 10% of monthly recurring expenses until you set one.",
    ],
  },
  "passive-income": {
    definition:
      "Identified this month: posted positive USD cash receipts you or your exact remembered rule marked as passive income. Cash receipts, before related expenses and taxes.",
    assumptions: [
      "Provider or model guesses can suggest passive income but can never assert it.",
      "Counts deposits in included spending or reserve accounts, not reinvestments in investment accounts.",
      "Not a tax treatment, investment performance or rental profit measure.",
    ],
  },
  debt: {
    definition: "Total current balance owed on included credit cards and loans.",
    assumptions: [
      "Uses current balance, not available credit or available spending balance.",
      "A positive credit or loan current balance is debt; a negative credit balance is an asset credit, not positive debt.",
      "Missing relevant current balances makes the total unavailable.",
    ],
  },
  cushion: {
    definition:
      "Explicitly designated emergency reserve balances divided by estimated monthly commitments.",
    assumptions: [
      "The denominator is the monthly equivalent of included standard recurring cash outflows plus the confirmed weekly essential allowance.",
      "Recurring outflows are a conservative proxy labelled estimated monthly commitments, not a claimed three-month historical average.",
      "Missing allowance, or a nonpositive or unknown denominator, makes the cushion unavailable.",
      "Card minimums are not inferred; a missing-debt-commitments note is shown instead.",
    ],
  },
  "net-worth": {
    definition: "Included account assets minus debt.",
    assumptions: [
      "Uses current balances.",
      "Positive credit or loan current balances count as debt; a negative credit balance counts as an asset.",
      "Missing relevant current balances makes the total unavailable.",
    ],
  },
};

export function explainMetric(snapshot: CashboardSnapshot, metricId: CashboardMetricId) {
  const summary = toConsumerSummary(snapshot);
  const metric = summary.metrics[metricId];
  const { definition, assumptions } = METRIC_DEFINITIONS[metricId];
  return { metric, definition, assumptions };
}

/** HTTP status mapping for deterministic capability error codes. */
export function httpStatusForErrorCode(code: string | undefined): number {
  switch (code) {
    case "invalid_input":
      return 400;
    case "missing_scope":
      return 403;
    case "rate_limited":
      return 429;
    case "snapshot_unavailable":
      return 503;
    default:
      return 400;
  }
}
