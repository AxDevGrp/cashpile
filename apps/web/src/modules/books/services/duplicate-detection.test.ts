import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTransactionFingerprint } from "./duplicate-detection";

describe("buildTransactionFingerprint", () => {
  it("normalizes whitespace, case, and amount formatting", () => {
    const a = buildTransactionFingerprint({ financialAccountId: "acct_1", date: "2026-05-25", amount: 12.9, description: " Coffee   Shop " });
    const b = buildTransactionFingerprint({ financialAccountId: "acct_1", date: "2026-05-25T12:00:00Z", amount: 12.90, description: "coffee shop" });
    assert.equal(a, b);
  });

  it("keeps different accounts distinct", () => {
    const a = buildTransactionFingerprint({ financialAccountId: "acct_1", date: "2026-05-25", amount: 12.9, description: "Coffee Shop" });
    const b = buildTransactionFingerprint({ financialAccountId: "acct_2", date: "2026-05-25", amount: 12.9, description: "Coffee Shop" });
    assert.notEqual(a, b);
  });

  it("keeps different dates distinct", () => {
    const a = buildTransactionFingerprint({ financialAccountId: "acct_1", date: "2026-05-25", amount: 12.9, description: "Coffee Shop" });
    const b = buildTransactionFingerprint({ financialAccountId: "acct_1", date: "2026-05-26", amount: 12.9, description: "Coffee Shop" });
    assert.notEqual(a, b);
  });
});
