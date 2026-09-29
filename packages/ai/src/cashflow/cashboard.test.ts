import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCashboardMetrics,
  localCalendarDate,
  type CashboardAccountInput,
  type CashboardInput,
  type CashboardReceipt,
  type CashboardScheduledFlow,
} from "./cashboard.ts";

const NOW = "2026-09-28T15:00:00.000Z";
const STALE_BEFORE = new Date("2026-09-26T15:00:00.000Z").getTime();

function account(overrides: Partial<CashboardAccountInput>): CashboardAccountInput {
  return {
    id: "acct",
    name: "Checking",
    role: "spending_source",
    accountType: "checking",
    included: true,
    currencyCode: "USD",
    currentBalanceCents: 0,
    spendableCents: 0,
    availableKnown: true,
    balanceAsOf: "2026-09-28T12:00:00.000Z",
    isEmergency: false,
    pendingDebitCents: 0,
    ...overrides,
  };
}

function input(overrides: Partial<CashboardInput>): CashboardInput {
  return {
    asOf: NOW,
    timezone: "America/New_York",
    today: "2026-09-28",
    monthStart: "2026-09-01",
    accounts: [account({})],
    scheduledFlows: [],
    windowEnd: "2026-10-01",
    payday: { nextPayday: "2026-10-02", provisional: false },
    bufferCents: 0,
    essentialWeeklyAllowanceCents: 0,
    essentialMonthlyCommitmentsCents: 0,
    receipts: [],
    unresolvedPositiveCents: 0,
    review: { count: 0, debitCents: 0, creditCents: 0 },
    thirtyDayShortfallCents: 0,
    staleBeforeMs: STALE_BEFORE,
    ...overrides,
  };
}

function flow(overrides: Partial<CashboardScheduledFlow>): CashboardScheduledFlow {
  return {
    id: "f",
    date: "2026-09-29",
    label: "Bill",
    amountCents: 0,
    direction: "expense",
    consumesSpendingCash: true,
    kind: "bill",
    ...overrides,
  };
}

describe("available metric", () => {
  it("reproduces the approved visual number", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [account({ spendableCents: 402000, currentBalanceCents: 402000 })],
        windowEnd: "2026-10-01",
        bufferCents: 50000,
        scheduledFlows: [
          flow({ id: "b1", date: "2026-09-29", amountCents: 38600 }),
          flow({ id: "b2", date: "2026-09-29", amountCents: 14200 }),
          flow({ id: "b3", date: "2026-09-30", amountCents: 15200 }),
          flow({ id: "b4", date: "2026-10-01", amountCents: 60000 }),
          flow({ id: "s1", date: "2026-09-30", amountCents: 40000, kind: "savings_transfer", label: "Savings" }),
        ],
      })
    );
    assert.equal(metrics.available.value, 184000);
    assert.equal(metrics.available.quality, "estimated");
    const lowRow = metrics.available.rows.find((r) => r.id === "low");
    assert.equal(lowRow?.value, 234000);
    assert.deepEqual(metrics.available.period, { from: "2026-09-28", through: "2026-10-01" });
  });

  it("subtracts an essentials allowance inside the window", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [account({ spendableCents: 402000 })],
        bufferCents: 50000,
        scheduledFlows: [
          flow({ id: "b1", date: "2026-09-29", amountCents: 38600 }),
          flow({ id: "b2", date: "2026-09-29", amountCents: 14200 }),
          flow({ id: "b3", date: "2026-09-30", amountCents: 15200 }),
          flow({ id: "b4", date: "2026-10-01", amountCents: 60000 }),
          flow({ id: "s1", date: "2026-09-30", amountCents: 40000, kind: "savings_transfer" }),
          flow({ id: "e1", date: "2026-09-30", amountCents: 10000, kind: "allowance" }),
        ],
      })
    );
    assert.equal(metrics.available.value, 174000);
  });

  it("preserves a shortfall instead of clamping to zero", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [account({ spendableCents: 40000 })],
        bufferCents: 10000,
        scheduledFlows: [flow({ date: "2026-09-30", amountCents: 60000 })],
      })
    );
    assert.equal(metrics.available.value, -30000);
    assert.ok(metrics.available.reasons.includes("projected_shortfall"));
  });

  it("uses the available balance, not current minus pending", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [
          account({ currentBalanceCents: 100000, spendableCents: 80000, availableKnown: true, pendingDebitCents: 20000 }),
        ],
      })
    );
    assert.equal(metrics.available.value, 80000);
  });

  it("is unavailable when only current balance is known and pending debits exist", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [
          account({ currentBalanceCents: 100000, spendableCents: 100000, availableKnown: false, pendingDebitCents: 20000 }),
        ],
      })
    );
    assert.equal(metrics.available.value, null);
    assert.equal(metrics.available.quality, "unavailable");
    assert.ok(metrics.available.reasons.includes("pending_balance_uncertain"));
  });

  it("is unavailable but keeps the payday value when a later bill risks the 30-day window", () => {
    const { metrics, warnings } = buildCashboardMetrics(
      input({
        accounts: [account({ spendableCents: 70000 })],
        thirtyDayShortfallCents: 20000,
      })
    );
    assert.equal(metrics.available.value, 70000);
    assert.ok(warnings.some((w) => w.code === "thirty_day_risk"));
  });

  it("is unavailable when the balance is stale", () => {
    const { metrics, warnings } = buildCashboardMetrics(
      input({
        accounts: [account({ spendableCents: 402000, balanceAsOf: "2026-09-20T12:00:00.000Z" })],
      })
    );
    assert.equal(metrics.available.value, null);
    assert.ok(metrics.available.reasons.includes("balance_stale"));
    assert.ok(warnings.some((w) => w.code === "balance_stale"));
  });
});

describe("debt and net worth", () => {
  it("uses current balances, not available credit", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [
          account({ id: "cash", role: "spending_source", currentBalanceCents: 200000 }),
          account({ id: "card", role: "credit_liability", accountType: "credit_card", currentBalanceCents: 50000 }),
        ],
      })
    );
    assert.equal(metrics.debt.value, 50000);
    assert.equal(metrics["net-worth"].value, 150000);
  });

  it("treats a negative credit balance as an asset", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [
          account({ id: "cash", currentBalanceCents: 200000 }),
          account({ id: "card", role: "credit_liability", accountType: "credit_card", currentBalanceCents: -5000 }),
        ],
      })
    );
    assert.equal(metrics.debt.value, 0);
    assert.equal(metrics["net-worth"].value, 205000);
  });

  it("is unavailable when a liability balance is unknown", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [
          account({ id: "cash", currentBalanceCents: 200000 }),
          account({ id: "card", role: "credit_liability", currentBalanceCents: null, spendableCents: null }),
        ],
      })
    );
    assert.equal(metrics.debt.value, null);
    assert.equal(metrics.debt.quality, "unavailable");
  });
});

describe("passive income", () => {
  const receipts: CashboardReceipt[] = [
    { id: "rent", date: "2026-09-03", label: "Rent", amountCents: 200000, accountId: "sp", kind: "passive_income", pending: false, confirmed: true },
    { id: "int", date: "2026-09-10", label: "Interest", amountCents: 31000, accountId: "sp", kind: "passive_income", pending: false, confirmed: true },
    { id: "wages", date: "2026-09-05", label: "Wages", amountCents: 400000, accountId: "sp", kind: "income", pending: false, confirmed: true },
    { id: "xfer", date: "2026-09-06", label: "Own transfer", amountCents: 50000, accountId: "sp", kind: "internal_transfer", pending: false, confirmed: true },
    { id: "div", date: "2026-09-20", label: "Dividend", amountCents: 5000, accountId: "sp", kind: "passive_income", pending: true, confirmed: true },
    { id: "reinv", date: "2026-09-12", label: "Reinvestment", amountCents: 8000, accountId: "inv", kind: "passive_income", pending: false, confirmed: true },
  ];

  function passiveInput(unresolvedPositiveCents = 0) {
    return input({
      accounts: [
        account({ id: "sp", role: "spending_source", currentBalanceCents: 500000 }),
        account({ id: "inv", role: "investment", accountType: "investment", currentBalanceCents: 100000 }),
      ],
      receipts,
      unresolvedPositiveCents,
    });
  }

  it("counts only confirmed posted passive receipts in spending/reserve accounts", () => {
    const { metrics } = buildCashboardMetrics(passiveInput());
    assert.equal(metrics["passive-income"].value, 231000);
    assert.deepEqual(metrics["passive-income"].period, { from: "2026-09-01", through: "2026-09-28" });
    assert.equal(metrics["passive-income"].quality, "available");
  });

  it("stays estimated with unresolved receipts", () => {
    const { metrics } = buildCashboardMetrics(passiveInput(10000));
    assert.equal(metrics["passive-income"].value, 231000);
    assert.equal(metrics["passive-income"].quality, "estimated");
    assert.ok(metrics["passive-income"].reasons.includes("unresolved_credit"));
  });
});

describe("cushion", () => {
  it("divides emergency reserve by estimated commitments plus allowance", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [account({ id: "res", role: "reserve", accountType: "savings", currentBalanceCents: 640000, isEmergency: true })],
        essentialMonthlyCommitmentsCents: 148000,
        essentialWeeklyAllowanceCents: 12000,
      })
    );
    assert.equal(metrics.cushion.value, 3.2);
    assert.equal(metrics.cushion.unit, "months");
  });

  it("is unavailable without a confirmed essential allowance", () => {
    const { metrics } = buildCashboardMetrics(
      input({
        accounts: [account({ id: "res", role: "reserve", currentBalanceCents: 640000, isEmergency: true })],
        essentialMonthlyCommitmentsCents: 148000,
        essentialWeeklyAllowanceCents: null,
      })
    );
    assert.equal(metrics.cushion.value, null);
    assert.equal(metrics.cushion.quality, "unavailable");
  });
});

describe("currency and timezone guards", () => {
  it("blocks all monetary metrics for a non-USD included account, then restores them", () => {
    const eur = account({ id: "eur", currencyCode: "EUR" });
    const blocked = buildCashboardMetrics(
      input({
        accounts: [account({ id: "usd", currentBalanceCents: 100000 }), eur],
      })
    );
    for (const id of ["available", "passive-income", "debt", "cushion", "net-worth"] as const) {
      assert.equal(blocked.metrics[id].quality, "unavailable", id);
    }

    const restored = buildCashboardMetrics(
      input({ accounts: [account({ id: "usd", currentBalanceCents: 100000 })] })
    );
    assert.notEqual(restored.metrics["net-worth"].quality, "unavailable");
  });

  it("derives today in the user's timezone, not UTC", () => {
    const { today } = localCalendarDate("2026-09-29T02:00:00.000Z", "America/New_York");
    assert.equal(today, "2026-09-28");
  });
});
