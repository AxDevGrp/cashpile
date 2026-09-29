import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveConsumerInterpretation,
  computeReviewRequired,
  type InterpretationRow,
} from "./consumer-interpretation.ts";

function row(overrides: Partial<InterpretationRow>): InterpretationRow {
  return {
    amountCents: -115000,
    description: "Rent",
    merchant: "Landlord",
    provider: null,
    engineCategoryId: null,
    engineCategoryConfident: false,
    modelCategoryId: null,
    modelConfidence: null,
    existing: null,
    sourceChanged: false,
    ...overrides,
  };
}

describe("consumer interpretation precedence", () => {
  it("retains a user decision and only reconfirms when source facts changed", () => {
    const existing = { kind: "spend" as const, source: "user" as const, categoryId: 900001 };
    const stable = deriveConsumerInterpretation(row({ existing }), null, null);
    assert.equal(stable.kind, "spend");
    assert.equal(stable.source, "user");
    assert.equal(stable.reviewRequired, false);

    const changed = deriveConsumerInterpretation(row({ existing, sourceChanged: true }), null, null);
    assert.equal(changed.kind, "spend");
    assert.equal(changed.reviewRequired, true);
  });

  it("lets an exact rule resolve a Zelle debit, otherwise it stays unknown", () => {
    const zelle = row({ description: "ZELLE TO FRIEND", engineCategoryId: 5, engineCategoryConfident: true });
    assert.equal(deriveConsumerInterpretation(zelle, null, null).kind, "unknown");

    const resolved = deriveConsumerInterpretation(zelle, { kind: "spend", categoryId: 5 }, { id: 5 });
    assert.equal(resolved.kind, "spend");
    assert.equal(resolved.source, "rule");
    assert.equal(resolved.reviewRequired, false);
  });

  it("maps a confident salary provider fact to income", () => {
    const result = deriveConsumerInterpretation(
      row({
        amountCents: 200000,
        description: "ACME PAYROLL",
        provider: { primary: "INCOME", detailed: "INCOME_WAGES", confidenceLevel: "VERY_HIGH" },
      }),
      null,
      null
    );
    assert.equal(result.kind, "income");
    assert.equal(result.source, "provider");
    assert.equal(result.reviewRequired, true);
  });

  it("maps provider interest to unknown with a passive-income suggestion", () => {
    const result = deriveConsumerInterpretation(
      row({
        amountCents: 3200,
        description: "INTEREST PAYMENT",
        provider: { primary: "INCOME", detailed: "INCOME_INTEREST_EARNED", confidenceLevel: "HIGH" },
      }),
      null,
      null
    );
    assert.equal(result.kind, "unknown");
    assert.equal(result.suggestion?.kind, "passive_income");
  });

  it("derives spend from a confident expense category on a debit", () => {
    const result = deriveConsumerInterpretation(
      row({
        description: "GROCERY",
        engineCategoryId: 12,
        engineCategoryConfident: true,
        provider: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES", confidenceLevel: "HIGH" },
      }),
      null,
      null
    );
    assert.equal(result.kind, "spend");
    assert.equal(result.reviewRequired, false);
  });

  it("does not auto-convert a provider transfer or loan payment", () => {
    for (const primary of ["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS"]) {
      const result = deriveConsumerInterpretation(
        row({
          engineCategoryId: 12,
          engineCategoryConfident: true,
          provider: { primary, detailed: null, confidenceLevel: "HIGH" },
        }),
        null,
        null
      );
      assert.equal(result.kind, "unknown", `primary ${primary}`);
    }
  });

  it("keeps an unrecognized provider taxonomy unknown", () => {
    const result = deriveConsumerInterpretation(
      row({
        amountCents: 5000,
        provider: { primary: "SOMETHING_NEW", detailed: "SOMETHING_NEW_WEIRD", confidenceLevel: "HIGH" },
      }),
      null,
      null
    );
    assert.equal(result.kind, "unknown");
  });

  it("requires clarification when a rule's category is missing", () => {
    const result = deriveConsumerInterpretation(row({}), { kind: "spend", categoryId: 7 }, null);
    assert.equal(result.kind, "spend");
    assert.equal(result.source, "rule");
    assert.equal(result.reviewRequired, true);
  });

  it("exposes the review-required rule", () => {
    assert.equal(computeReviewRequired("spend", 1), false);
    assert.equal(computeReviewRequired("spend", null), true);
    assert.equal(computeReviewRequired("unknown", 1), true);
    assert.equal(computeReviewRequired("refund", null), false);
  });
});
