import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CashboardSnapshot } from "@cashpile/ai";
import {
  CASHBOARD_METRIC_IDS,
  METRIC_DEFINITIONS,
  explainMetric,
  httpStatusForErrorCode,
  toConsumerSummary,
  validateMetricExplainInput,
  validateSummaryInput,
} from "./consumer-agent.ts";

function snapshot(): CashboardSnapshot {
  const metrics = {} as CashboardSnapshot["metrics"];
  for (const id of CASHBOARD_METRIC_IDS) {
    metrics[id] = {
      id,
      value: 1234,
      unit: id === "cushion" ? "months" : "USD_cents",
      quality: "available",
      period: { from: "2026-09-01", through: "2026-09-30" },
      asOf: "2026-09-29T12:00:00.000Z",
      reasons: [],
      rows: [{ id: "tx-1", label: "Secret merchant", value: -100 }],
    };
  }
  return {
    version: 1,
    asOf: "2026-09-29T12:00:00.000Z",
    timezone: "America/New_York",
    currency: "USD",
    metrics,
    cashflow: { safeToSpend: 999, accountSummaries: [{ accountId: "acct-secret" }] },
    review: { count: 7, debitCents: 500, creditCents: 800 },
    warnings: [{ code: "x", message: "y", accountId: "acct-secret" }],
  } as unknown as CashboardSnapshot;
}

describe("cashboard.summary.get shaping", () => {
  it("returns only aggregate metric fields and the unresolved count", () => {
    const out = toConsumerSummary(snapshot());
    const serialized = JSON.stringify(out);
    assert.equal(out.version, 1);
    assert.equal(out.currency, "USD");
    assert.equal(out.unresolvedCount, 7);
    assert.equal(out.metrics.available.value, 1234);
    assert.equal(Object.keys(out.metrics).length, 5);
    for (const id of CASHBOARD_METRIC_IDS) {
      assert.deepEqual(Object.keys(out.metrics[id]).sort(), [
        "asOf",
        "id",
        "period",
        "quality",
        "reasons",
        "unit",
        "value",
      ]);
    }
    // No evidence rows, cashflow snapshot, transactions, account ids or descriptions.
    assert.equal(serialized.includes("Secret merchant"), false);
    assert.equal(serialized.includes("acct-secret"), false);
    assert.equal(serialized.includes("safeToSpend"), false);
    assert.equal(serialized.includes("rows"), false);
    assert.equal(serialized.includes("debitCents"), false);
  });
});

describe("cashboard.metric.explain", () => {
  it("returns the aggregate metric plus deterministic definition and assumptions", () => {
    const out = explainMetric(snapshot(), "cushion");
    assert.equal(out.metric.id, "cushion");
    assert.equal(out.metric.unit, "months");
    assert.equal(out.definition, METRIC_DEFINITIONS.cushion.definition);
    assert.ok(out.assumptions.length > 0);
    assert.equal(JSON.stringify(out).includes("Secret merchant"), false);
  });
});

describe("strict input validation", () => {
  it("accepts an empty object and rejects extra keys including userId", () => {
    assert.deepEqual(validateSummaryInput({}), {});
    assert.deepEqual(validateSummaryInput(undefined), {});
    assert.equal(validateSummaryInput({ userId: "someone" }), null);
    assert.equal(validateSummaryInput({ limit: 5 }), null);
  });

  it("accepts only the five metric ids and rejects extras", () => {
    assert.deepEqual(validateMetricExplainInput({ metricId: "debt" }), { metricId: "debt" });
    assert.equal(validateMetricExplainInput({ metricId: "income" }), null);
    assert.equal(validateMetricExplainInput({ metricId: "debt", owner: "x" }), null);
    assert.equal(validateMetricExplainInput({}), null);
  });
});

describe("http status mapping", () => {
  it("maps each deterministic error code", () => {
    assert.equal(httpStatusForErrorCode("invalid_input"), 400);
    assert.equal(httpStatusForErrorCode("missing_scope"), 403);
    assert.equal(httpStatusForErrorCode("rate_limited"), 429);
    assert.equal(httpStatusForErrorCode("snapshot_unavailable"), 503);
    assert.equal(httpStatusForErrorCode(undefined), 400);
    assert.equal(httpStatusForErrorCode("something_legacy"), 400);
  });
});
