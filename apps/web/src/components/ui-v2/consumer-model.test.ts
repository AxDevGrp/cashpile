import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSUMER_METRIC_HREFS,
  availableShortfallCents,
  clearConsumerReviewStorage,
  consumerReviewSkipKey,
  formatMetricValue,
  formatMoneyCents,
  formatMonths,
  isConsumerMetricId,
  metricTone,
  resolveMetricParam,
} from "./consumer-model.ts";

const currency = (dollars: number) => `$${dollars.toFixed(2)}`;

describe("consumer metric routing", () => {
  it("fixes tile hrefs", () => {
    assert.equal(CONSUMER_METRIC_HREFS.available, "/cashflow?view=details");
    assert.equal(CONSUMER_METRIC_HREFS["passive-income"], "/cashboard?metric=passive-income");
    assert.equal(CONSUMER_METRIC_HREFS.debt, "/cashboard?metric=debt");
    assert.equal(CONSUMER_METRIC_HREFS.cushion, "/cashboard?metric=cushion");
    assert.equal(CONSUMER_METRIC_HREFS["net-worth"], "/cashboard?metric=net-worth");
  });

  it("falls back to home for an unknown metric", () => {
    assert.equal(resolveMetricParam("debt"), "debt");
    assert.equal(resolveMetricParam("wat"), null);
    assert.equal(resolveMetricParam(null), null);
    assert.equal(isConsumerMetricId("cushion"), true);
    assert.equal(isConsumerMetricId("nope"), false);
  });
});

describe("consumer value formatting", () => {
  it("formats cents as currency and distinguishes null from zero", () => {
    assert.equal(formatMoneyCents(184000, currency), "$1840.00");
    assert.equal(formatMoneyCents(0, currency), "$0.00");
    assert.equal(formatMoneyCents(null, currency), "—");
    assert.equal(formatMoneyCents(undefined, currency), "—");
  });

  it("keeps one decimal for months", () => {
    assert.equal(formatMonths(3.2), "3.2");
    assert.equal(formatMonths(null), "—");
  });

  it("routes formatting by unit with no other arithmetic", () => {
    assert.equal(formatMetricValue({ value: 231000, unit: "USD_cents" }, currency), "$2310.00");
    assert.equal(formatMetricValue({ value: 3.2, unit: "months" }, currency), "3.2");
  });
});

describe("consumer metric tone and shortfall", () => {
  it("marks unavailable metrics neutral and never zero", () => {
    assert.equal(metricTone({ id: "available", value: null, quality: "unavailable" }), "unavailable");
  });

  it("marks positive availability lime and negative as a shortfall", () => {
    assert.equal(metricTone({ id: "available", value: 184000, quality: "estimated" }), "positive");
    assert.equal(metricTone({ id: "available", value: -30000, quality: "estimated" }), "negative");
    assert.equal(availableShortfallCents({ id: "available", value: -30000 }), 30000);
    assert.equal(availableShortfallCents({ id: "available", value: 184000 }), null);
    assert.equal(availableShortfallCents({ id: "debt", value: -30000 }), null);
  });
});

describe("consumer review storage scoping", () => {
  it("scopes skipped ids per user and can be cleared on sign-out", () => {
    assert.equal(consumerReviewSkipKey("u1"), "cashpile-consumer-review-skipped:u1");
    assert.notEqual(consumerReviewSkipKey("u1"), consumerReviewSkipKey("u2"));

    const removed: string[] = [];
    clearConsumerReviewStorage((key) => removed.push(key), "u1");
    assert.deepEqual(removed, ["cashpile-consumer-review-skipped:u1"]);
  });
});
