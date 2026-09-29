import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_AMOUNT_CENTS,
  PlaidIngestionError,
  normalizePlaidBalance,
  normalizePlaidTransaction,
  toAmountCents,
} from "./plaid-ingestion.ts";

const baseTx = {
  transaction_id: "plaid-tx-1",
  account_id: "plaid-acct-1",
  amount: 42.1,
  date: "2026-09-15",
  name: "Corner Store",
  merchant_name: "Corner Store LLC",
  pending: false,
  pending_transaction_id: null,
  iso_currency_code: "USD",
  unofficial_currency_code: null,
  personal_finance_category: {
    primary: "FOOD_AND_DRINK",
    detailed: "FOOD_AND_DRINK_GROCERIES",
    confidence_level: "HIGH",
  },
};

describe("plaid-ingestion amount mapping", () => {
  it("maps a provider debit 42.10 to -4210 cents", () => {
    assert.equal(toAmountCents(42.1), -4210);
    const row = normalizePlaidTransaction(baseTx, "acct-local-1");
    assert.equal(row.amountCents, -4210);
    assert.equal(row.transaction_type, "debit");
  });

  it("maps a provider credit to positive cents", () => {
    const row = normalizePlaidTransaction({ ...baseTx, transaction_id: "p2", amount: -2000 }, "acct-local-1");
    assert.equal(row.amountCents, 200000);
    assert.equal(row.transaction_type, "credit");
  });

  it("rejects non-finite and out-of-bound amounts", () => {
    assert.throws(() => toAmountCents(Number.NaN), PlaidIngestionError);
    assert.throws(() => toAmountCents(Infinity), PlaidIngestionError);
    assert.throws(() => toAmountCents(MAX_AMOUNT_CENTS), PlaidIngestionError);
  });

  it("blocks ingestion when the account mapping is missing", () => {
    assert.throws(() => normalizePlaidTransaction(baseTx, null), (err: unknown) => {
      assert.ok(err instanceof PlaidIngestionError);
      assert.equal((err as PlaidIngestionError).code, "missing_account_mapping");
      return true;
    });
  });
});

describe("plaid-ingestion output surface", () => {
  it("never supplies category, notes or a consumer decision", () => {
    const row = normalizePlaidTransaction(baseTx, "acct-local-1");
    const keys = Object.keys(row);
    for (const forbidden of ["category_id", "notes", "kind", "review_required", "is_transfer"]) {
      assert.ok(!keys.includes(forbidden), `unexpected key ${forbidden}`);
    }
    assert.deepEqual(keys.sort(), [
      "amountCents",
      "date",
      "description",
      "financial_account_id",
      "merchant",
      "plaid_transaction_id",
      "provider_data",
      "transaction_type",
    ]);
  });

  it("preserves the full provider finance category and missing values as null", () => {
    const row = normalizePlaidTransaction(
      { ...baseTx, iso_currency_code: null, personal_finance_category: { primary: "INCOME" } },
      "acct-local-1"
    );
    assert.deepEqual(row.provider_data.personal_finance_category, {
      primary: "INCOME",
      detailed: null,
      confidence_level: null,
    });
    assert.equal(row.provider_data.iso_currency_code, null);
    assert.equal(row.provider_data.pending, false);
  });

  it("keeps a pending transaction's provider id link", () => {
    const row = normalizePlaidTransaction(
      { ...baseTx, transaction_id: "posted-q", pending_transaction_id: "pending-p", pending: true },
      "acct-local-1"
    );
    assert.equal(row.provider_data.pending_transaction_id, "pending-p");
    assert.equal(row.provider_data.pending, true);
  });
});

describe("plaid-ingestion balances", () => {
  it("keeps unknown balance and currency null rather than zero", () => {
    assert.deepEqual(normalizePlaidBalance(null), {
      current_balance: null,
      available_balance: null,
      currency_code: null,
    });
    assert.deepEqual(normalizePlaidBalance({ current: null, available: undefined, iso_currency_code: null }), {
      current_balance: null,
      available_balance: null,
      currency_code: null,
    });
  });

  it("keeps known balances and real currency", () => {
    assert.deepEqual(normalizePlaidBalance({ current: 4020, available: 3900, iso_currency_code: "USD" }), {
      current_balance: 4020,
      available_balance: 3900,
      currency_code: "USD",
    });
  });
});
