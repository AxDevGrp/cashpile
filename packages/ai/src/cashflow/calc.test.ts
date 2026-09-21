import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceOccurrence,
  availabilityInWindow,
  clampHorizonDays,
  computeCashflow,
  computeCushion,
  computeMonthlyMargins,
  computeNetWorth,
  detectCadence,
  essentialMonthlyOutflowCents,
  expandOccurrences,
  isBalanceStale,
  isValidISODate,
  looksLikeSubscription,
  mergeRecurringItems,
  monthlyEquivalentCents,
  selectPayday,
  simulate,
  type CalcAccount,
  type CalcInput,
  type CalcObservedTxn,
  type CalcRecurringItem,
  type CalcScenario,
  type PersistedRecurringItem,
} from "./calc.ts";

const TODAY = "2026-09-09";
const CHECKING = "checking";
const CHECKING_B = "checking_b";
const SAVINGS = "savings";
const CARD = "card";

function account(id: string, role: CalcAccount["role"], cents: number, isEmergency = false): CalcAccount {
  return { id, role, included: true, spendableCents: cents, balanceAsOf: "2026-09-09T08:00:00.000Z", isEmergency };
}

function item(
  id: string,
  merchant: string,
  amountCents: number,
  direction: "income" | "expense",
  cadence: CalcRecurringItem["cadence"],
  anchorDate: string,
  accountIds: string[],
  extra: Partial<CalcRecurringItem> = {},
): CalcRecurringItem {
  return {
    id,
    merchant,
    amountCents,
    direction,
    cadence,
    anchorDate,
    accountIds,
    flowKind: "standard",
    cashEffect: true,
    landsOnSpendable: true,
    included: true,
    confirmed: false,
    ...extra,
  };
}

function baseInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    today: TODAY,
    horizonDays: 30,
    bufferCents: 25000,
    accounts: [account(CHECKING, "spending_source", 120000)],
    recurring: [],
    essentialWeeklyAllowanceCents: null,
    scenarios: [],
    paydayDate: null,
    paydayProvisional: true,
    observed: [],
    dataQuality: { historyDays: 365, historyComplete: true, accountsIncluded: 1, accountsExcluded: 0, pendingCount: 0, pendingNetCents: 0 },
    ...overrides,
  };
}

describe("fixture A — until payday availability", () => {
  const input = baseInput({
    bufferCents: 25000,
    recurring: [
      item("pay", "Paycheck", 200000, "income", "biweekly", "2026-09-04", [CHECKING]),
      item("net", "Internet", 8000, "expense", "monthly", "2026-08-10", [CHECKING], { anchorDaysOfMonth: [10] }),
      item("sav", "Savings transfer", 10000, "expense", "monthly", "2026-08-15", [CHECKING], { anchorDaysOfMonth: [15], flowKind: "internal_transfer" }),
      item("rent", "Rent", 150000, "expense", "monthly", "2026-08-30", [CHECKING], { anchorDaysOfMonth: [30] }),
    ],
    essentialWeeklyAllowanceCents: 7000,
    paydayDate: "2026-09-18",
  });

  it("computes $700 available until payday (low $950 − buffer $250)", () => {
    const snap = computeCashflow(input);
    assert.equal(snap.paydayWindow.nextPayday, "2026-09-18");
    assert.equal(snap.paydayWindow.end, "2026-09-17");
    assert.ok(snap.availability);
    assert.equal(snap.availability.lowCents, 95000);
    assert.equal(snap.availability.availableCents, 70000);
  });

  it("starts the simulation from the resolved spendable basis", () => {
    const sim = simulate(input);
    assert.equal(sim.openingCents, 120000);
  });
});

describe("fixture D — 30-day cash risk and shortfall display", () => {
  it("tracks the 30-day low including events after payday", () => {
    const input = baseInput({
      recurring: [
        item("pay", "Paycheck", 200000, "income", "biweekly", "2026-09-04", [CHECKING]),
        item("net", "Internet", 8000, "expense", "monthly", "2026-08-10", [CHECKING], { anchorDaysOfMonth: [10] }),
        item("sav", "Savings transfer", 10000, "expense", "monthly", "2026-08-15", [CHECKING], { anchorDaysOfMonth: [15] }),
        item("rent", "Rent", 150000, "expense", "monthly", "2026-08-30", [CHECKING], { anchorDaysOfMonth: [30] }),
      ],
      essentialWeeklyAllowanceCents: 7000,
      paydayDate: "2026-09-18",
    });
    const snap = computeCashflow(input);
    assert.equal(snap.risk.lowCents, 95000);
    assert.equal(snap.risk.lowDate, "2026-09-15");
    assert.equal(snap.risk.shortfallCents, 0);
    assert.equal(snap.risk.firstBelowBufferDate, null);
    assert.equal(snap.risk.firstNegativeDate, null);
  });

  it("reports a projected shortfall instead of clamping to zero", () => {
    const input = baseInput({
      accounts: [account(CHECKING, "spending_source", 40000)],
      recurring: [
        item("net", "Internet", 8000, "expense", "monthly", "2026-08-10", [CHECKING], { anchorDaysOfMonth: [10] }),
        item("sav", "Savings transfer", 10000, "expense", "monthly", "2026-08-15", [CHECKING], { anchorDaysOfMonth: [15], flowKind: "internal_transfer" }),
        item("rent", "Rent", 150000, "expense", "monthly", "2026-08-30", [CHECKING], { anchorDaysOfMonth: [30] }),
      ],
      essentialWeeklyAllowanceCents: 7000,
      paydayDate: null,
    });
    const snap = computeCashflow(input);
    assert.equal(snap.risk.lowCents, -156000);
    assert.equal(snap.risk.lowDate, "2026-10-05");
    assert.equal(snap.risk.shortfallCents, 156000);
    assert.equal(snap.risk.firstNegativeDate, "2026-09-30");
    assert.ok(snap.availability);
    assert.ok(snap.availability.availableCents < 0);
  });
});

describe("fixture B — monthly margin counts card purchases once", () => {
  const observed: CalcObservedTxn[] = [
    { date: "2026-08-07", amountCents: 200000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-21", amountCents: 200000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-01", amountCents: -150000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-05", amountCents: -20000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-03", amountCents: -15000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-10", amountCents: -15000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-17", amountCents: -15000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-24", amountCents: -15000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-06", amountCents: -9000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-12", amountCents: -50000, accountId: CARD, accountRole: "credit_liability", accountIncluded: true, pending: false },
    { date: "2026-08-20", amountCents: -30000, accountId: CARD, accountRole: "credit_liability", accountIncluded: true, pending: false },
    { date: "2026-08-25", amountCents: -80000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-25", amountCents: 80000, accountId: CARD, accountRole: "credit_liability", accountIncluded: true, pending: false },
    { date: "2026-08-15", amountCents: -10000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-15", amountCents: 10000, accountId: SAVINGS, accountRole: "reserve", accountIncluded: true, pending: false },
  ];

  it("margin $810: income $4000 − expenses $3190, card payment and savings transfer excluded", () => {
    const margins = computeMonthlyMargins(observed, TODAY);
    const august = margins.find((m) => m.month === "2026-08");
    assert.ok(august);
    assert.equal(august.partialMonth, false);
    assert.equal(august.through, "2026-08-31");
    assert.equal(august.incomeCents, 400000);
    assert.equal(august.expenseCents, 319000);
    assert.equal(august.marginCents, 81000);
    assert.equal(august.cardPaymentCents, 80000);
    assert.equal(august.savingsAllocationCents, 10000);
  });

  it("marks the current month partial and measured through today", () => {
    const margins = computeMonthlyMargins(
      [{ date: "2026-09-02", amountCents: -5000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false }],
      TODAY,
    );
    const september = margins.find((m) => m.month === "2026-09");
    assert.ok(september);
    assert.equal(september.partialMonth, true);
    assert.equal(september.through, TODAY);
    assert.equal(september.expenseCents, 5000);
  });
});

describe("fixture C — emergency cushion", () => {
  it("$3600 reserve over $2400 monthly essentials is 1.5 months", () => {
    const cushion = computeCushion(360000, 240000);
    assert.equal(cushion.months, 1.5);
  });

  it("essentials exclude internal transfers and card purchases", () => {
    const recurring = [
      item("rent", "Rent", 150000, "expense", "monthly", "2026-08-30", [CHECKING], { anchorDaysOfMonth: [30] }),
      item("sav", "Savings transfer", 10000, "expense", "monthly", "2026-08-15", [CHECKING], { anchorDaysOfMonth: [15], flowKind: "internal_transfer" }),
      item("cardbuy", "Card purchase", 30000, "expense", "monthly", "2026-08-12", [CARD], { anchorDaysOfMonth: [12], cashEffect: false, landsOnSpendable: false }),
    ];
    const essentials = essentialMonthlyOutflowCents({ recurring, essentialWeeklyAllowanceCents: 7000 });
    assert.ok(essentials !== null);
    assert.equal(essentials, 150000 + monthlyEquivalentCents(7000, "weekly"));
  });

  it("unknown essentials yield a null cushion, not zero months", () => {
    const cushion = computeCushion(360000, null);
    assert.equal(cushion.months, null);
  });
});

describe("fixture E — calendar-aware recurrence", () => {
  it("monthly keeps the anchor day across months instead of adding 30 days", () => {
    const dates = expandOccurrences({ cadence: "monthly", anchorDate: "2026-01-31", anchorDaysOfMonth: [31] }, "2026-02-01", "2026-05-31");
    assert.deepEqual(dates, ["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("month-end clamping restores the anchor day when the next month allows it", () => {
    assert.equal(advanceOccurrence("2026-09-30", { cadence: "monthly", anchorDate: "2026-09-30", anchorDaysOfMonth: [31] }), "2026-10-31");
    assert.equal(advanceOccurrence("2026-10-31", { cadence: "monthly", anchorDate: "2026-10-31", anchorDaysOfMonth: [31] }), "2026-11-30");
    assert.equal(advanceOccurrence("2027-01-31", { cadence: "monthly", anchorDate: "2027-01-31", anchorDaysOfMonth: [31] }), "2027-02-28");
  });

  it("annual cadence handles leap-day anchors", () => {
    assert.equal(advanceOccurrence("2028-02-29", { cadence: "annual", anchorDate: "2028-02-29", anchorDaysOfMonth: [29] }), "2029-02-28");
  });

  it("twice-monthly pay lands on both anchor days", () => {
    const dates = expandOccurrences({ cadence: "twice_monthly", anchorDate: "2026-09-01", anchorDaysOfMonth: [1, 15] }, "2026-09-09", "2026-10-09");
    assert.deepEqual(dates, ["2026-09-15", "2026-10-01"]);
  });

  it("detects twice-monthly pay from 1st/15th occurrence dates", () => {
    const result = detectCadence(["2026-08-01", "2026-08-15", "2026-09-01", "2026-09-15"]);
    assert.ok(result);
    assert.equal(result.cadence, "twice_monthly");
    assert.deepEqual(result.anchorDaysOfMonth, [1, 15]);
  });

  it("does not mistake an exact 14-day cycle for twice-monthly", () => {
    const result = detectCadence(["2026-08-05", "2026-08-19", "2026-09-02"]);
    assert.ok(result);
    assert.equal(result.cadence, "biweekly");
  });
});

describe("fixture F — card purchase and payment are not double-counted", () => {
  const input = baseInput({
    accounts: [account(CHECKING, "spending_source", 100000), account(CARD, "credit_liability", -30000)],
    recurring: [
      item("cardpay", "Card payment", 30000, "expense", "monthly", "2026-08-25", [CHECKING], { anchorDaysOfMonth: [25], flowKind: "card_payment" }),
      item("cardbuy", "Card purchase", 30000, "expense", "monthly", "2026-08-12", [CARD], { anchorDaysOfMonth: [12], cashEffect: false, landsOnSpendable: false }),
    ],
    paydayDate: "2026-09-18",
  });

  it("card purchases never touch spendable cash; the payment does, once", () => {
    const snap = computeCashflow(input);
    assert.equal(snap.availability?.availableCents, 75000);
    assert.equal(snap.risk.lowCents, 70000);
    assert.equal(snap.risk.lowDate, "2026-09-25");
    assert.equal(snap.sim.upcomingExpenses.length, 1);
    assert.equal(snap.sim.upcomingExpenses[0].label, "Card payment");
  });

  it("a same-day paycheck does not erase a bill-timing risk", () => {
    const risky = baseInput({
      accounts: [account(CHECKING, "spending_source", 30000)],
      recurring: [
        item("pay", "Paycheck", 200000, "income", "monthly", "2026-08-18", [CHECKING], { anchorDaysOfMonth: [18] }),
        item("rent", "Rent", 150000, "expense", "monthly", "2026-08-18", [CHECKING], { anchorDaysOfMonth: [18] }),
      ],
    });
    const snap = computeCashflow(risky);
    assert.equal(snap.risk.lowCents, -120000);
    assert.equal(snap.risk.lowDate, "2026-09-18");
    assert.equal(snap.risk.shortfallCents, 120000);
  });
});

describe("fixture H — reserves are not spendable; scenarios reduce availability exactly once", () => {
  const accounts = [account(CHECKING, "spending_source", 120000), account(SAVINGS, "reserve", 360000, true)];

  it("reserve balances never enter spendable cash, only the emergency cushion", () => {
    const snap = computeCashflow(baseInput({ accounts }));
    assert.equal(snap.sim.openingCents, 120000);
    assert.equal(snap.cushion.reserveCents, 360000);
  });

  it("only emergency-designated reserves count toward the cushion", () => {
    const snap = computeCashflow(baseInput({
      accounts: [account(CHECKING, "spending_source", 120000), account(SAVINGS, "reserve", 360000)],
    }));
    assert.equal(snap.sim.openingCents, 120000);
    assert.equal(snap.cushion.reserveCents, 0);
  });

  it("a $400 purchase reduces availability by exactly $400", () => {
    const scenario: CalcScenario = { id: "p", type: "purchase", amountCents: 40000, date: "2026-09-12" };
    const before = computeCashflow(baseInput({ accounts }));
    const after = computeCashflow(baseInput({ accounts, scenarios: [scenario] }));
    assert.equal(before.availability!.availableCents - after.availability!.availableCents, 40000);
    assert.equal(after.cushion.reserveCents, 360000);
  });

  it("a savings transfer reduces spending cash the same way", () => {
    const scenario: CalcScenario = { id: "t", type: "savings_transfer", amountCents: 40000, date: "2026-09-12", reserveAccountId: SAVINGS };
    const before = computeCashflow(baseInput({ accounts }));
    const after = computeCashflow(baseInput({ accounts, scenarios: [scenario] }));
    assert.equal(before.availability!.availableCents - after.availability!.availableCents, 40000);
  });

  it("scenario dates outside the supported window produce no projected item", () => {
    const scenario: CalcScenario = { id: "late", type: "purchase", amountCents: 40000, date: "2026-12-01" };
    const snap = computeCashflow(baseInput({ accounts, scenarios: [scenario] }));
    assert.equal(snap.sim.upcomingExpenses.filter((i) => i.scenarioId).length, 0);
  });

  it("the scenario date visibly changes the projected low", () => {
    const recurring = [item("net", "Internet", 8000, "expense", "monthly", "2026-08-10", [CHECKING], { anchorDaysOfMonth: [10] })];
    const early = computeCashflow(baseInput({
      accounts,
      recurring,
      scenarios: [{ id: "p", type: "purchase", amountCents: 30000, date: "2026-09-10" }],
    }));
    const late = computeCashflow(baseInput({
      accounts,
      recurring,
      scenarios: [{ id: "p", type: "purchase", amountCents: 30000, date: "2026-09-25" }],
    }));
    assert.equal(early.risk.lowCents, 120000 - 30000 - 8000);
    assert.equal(early.risk.lowDate, "2026-09-10");
    assert.equal(early.availability!.availableCents, 120000 - 30000 - 8000 - 25000);
    assert.equal(late.risk.lowCents, 120000 - 30000 - 8000);
    assert.equal(late.risk.lowDate, "2026-09-25");
    assert.equal(late.availability!.availableCents, 120000 - 8000 - 25000);
    assert.notEqual(early.risk.lowDate, late.risk.lowDate);
    assert.notEqual(early.availability!.availableCents, late.availability!.availableCents);
  });
});

describe("per-account risk — aggregate cash can hide an individual shortfall", () => {
  it("flags the overdrawn account even when the aggregate stays positive", () => {
    const input = baseInput({
      accounts: [account(CHECKING, "spending_source", 50000), account(CHECKING_B, "spending_source", 5000)],
      recurring: [item("bill", "Big bill", 30000, "expense", "monthly", "2026-08-20", [CHECKING_B], { anchorDaysOfMonth: [20] })],
    });
    const snap = computeCashflow(input);
    assert.equal(snap.risk.lowCents, 25000);
    assert.equal(snap.sim.perAccountLow[CHECKING_B].cents, -25000);
    assert.equal(snap.sim.perAccountLow[CHECKING].cents, 50000);
  });
});

describe("no spending accounts — availability is null, not zero", () => {
  it("distinguishes an empty forecast from a $0 answer", () => {
    const snap = computeCashflow(baseInput({ accounts: [account(SAVINGS, "reserve", 50000)] }));
    assert.equal(snap.availability, null);
  });
});

describe("data trust rules", () => {
  it("marks balances stale when the basis is missing or older than 48 hours", () => {
    assert.equal(isBalanceStale(null), true);
    assert.equal(isBalanceStale("2026-09-09T08:00:00Z", Date.parse("2026-09-09T10:00:00Z")), false);
    assert.equal(isBalanceStale("2026-09-01T08:00:00Z", Date.parse("2026-09-09T10:00:00Z")), true);
  });

  it("rejects dates that are not real calendar dates", () => {
    assert.equal(isValidISODate("2026-02-30"), false);
    assert.equal(isValidISODate("2026-13-01"), false);
    assert.equal(isValidISODate("2026-09-09"), true);
  });

  it("bounds forecast horizons to 7–90 days", () => {
    assert.equal(clampHorizonDays(3), 7);
    assert.equal(clampHorizonDays(365), 90);
    assert.equal(clampHorizonDays(30), 30);
    assert.equal(clampHorizonDays(Number.NaN), 30);
  });

  it("keeps cent-precision money math exact", () => {
    const input = baseInput({
      recurring: [
        item("a", "Odd amount", 19999, "expense", "monthly", "2026-08-11", [CHECKING], { anchorDaysOfMonth: [11] }),
        item("b", "Cent", 1, "expense", "monthly", "2026-08-12", [CHECKING], { anchorDaysOfMonth: [12] }),
      ],
    });
    const snap = computeCashflow(input);
    assert.equal(snap.risk.lowCents, 120000 - 20000);
  });
});

describe("WP2 — persisted corrections merge with detection", () => {
  const proposal: import("./types.ts").RecurringItem = {
    id: "ephemeral-1",
    merchant: "Rent",
    descriptionPattern: "rent group",
    averageAmount: 45,
    direction: "expense",
    cadence: "monthly",
    nextExpectedDate: "2026-09-30",
    confidence: 0.8,
    accountIds: [CHECKING],
    transactionIds: ["t1", "t2", "t3"],
    lastSeenDate: "2026-08-30",
    anchorDaysOfMonth: [30],
    stableKey: "expense|rent group|45",
    confirmed: false,
    included: true,
    source: "detected",
  };

  function persistedRow(overrides: Partial<PersistedRecurringItem> = {}): PersistedRecurringItem {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      stableKey: "expense|rent group|45",
      direction: "expense",
      merchant: "Rent",
      descriptionPattern: "rent group",
      amountCents: 6000,
      cadence: "monthly",
      nextDate: "2026-09-30",
      anchorDaysOfMonth: [30],
      accountIds: [CHECKING],
      included: true,
      confirmedAt: "2026-09-08T10:00:00Z",
      flowKind: "standard",
      counterpartyAccountIds: [],
      isSubscription: false,
      reviewStatus: null,
      lastSeenDate: "2026-08-30",
      source: "detected",
      ...overrides,
    };
  }

  it("a correction replaces its detection proposal exactly once", () => {
    const merged = mergeRecurringItems([proposal], [persistedRow()], TODAY, null);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, "11111111-1111-4111-8111-111111111111");
    assert.equal(merged[0].averageAmount, 60);
    assert.equal(merged[0].confirmed, true);
  });

  it("the corrected item reaches the forecast once, with the corrected amount", () => {
    const merged = mergeRecurringItems([proposal], [persistedRow()], TODAY, null);
    const snap = computeCashflow(baseInput({
      recurring: [{
        id: merged[0].id,
        merchant: merged[0].merchant,
        amountCents: Math.round(merged[0].averageAmount * 100),
        direction: "expense",
        cadence: merged[0].cadence,
        anchorDate: merged[0].lastSeenDate ?? TODAY,
        anchorDaysOfMonth: merged[0].anchorDaysOfMonth,
        accountIds: merged[0].accountIds,
        flowKind: "standard",
        cashEffect: true,
        landsOnSpendable: true,
        included: true,
        confirmed: true,
      }],
    }));
    assert.equal(snap.sim.upcomingExpenses.length, 1);
    assert.equal(snap.sim.upcomingExpenses[0].amountCents, 6000);
    assert.equal(snap.risk.lowCents, 120000 - 6000);
  });

  it("'not recurring' removes the forecast item but keeps it in the merged list", () => {
    const merged = mergeRecurringItems([proposal], [persistedRow({ included: false })], TODAY, null);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].included, false);
    const snap = computeCashflow(baseInput({
      recurring: [{
        ...item(merged[0].id, merged[0].merchant, 6000, "expense", "monthly", merged[0].lastSeenDate!, [CHECKING], { anchorDaysOfMonth: [30] }),
        included: false,
      }],
    }));
    assert.equal(snap.sim.upcomingExpenses.length, 0);
    assert.equal(snap.risk.lowCents, 120000);
  });

  it("a manual item with no account lands on the fallback spending account", () => {
    const manual = persistedRow({
      id: "22222222-2222-4222-8222-222222222222",
      stableKey: "income|paycheck|1500",
      direction: "income",
      merchant: "Paycheck",
      descriptionPattern: "paycheck",
      amountCents: 150000,
      accountIds: [],
      nextDate: "2026-09-15",
      anchorDaysOfMonth: [15],
      source: "manual",
      lastSeenDate: null,
    });
    const merged = mergeRecurringItems([], [manual], TODAY, CHECKING);
    assert.deepEqual(merged[0].accountIds, [CHECKING]);
    assert.equal(merged[0].source, "manual");
  });

  it("a stale persisted next date advances to the next occurrence", () => {
    const stale = persistedRow({ nextDate: "2026-08-30" });
    const merged = mergeRecurringItems([], [stale], TODAY, null);
    assert.equal(merged[0].nextExpectedDate, "2026-09-30");
  });

  it("unrelated proposals pass through untouched", () => {
    const other = { ...proposal, stableKey: "expense|other|20", merchant: "Other" };
    const merged = mergeRecurringItems([other], [persistedRow()], TODAY, null);
    assert.equal(merged.length, 2);
    assert.ok(merged.some((m) => m.stableKey === "expense|other|20" && m.confirmed === false));
  });
});

describe("WP2 — payday selection prefers confirmed income", () => {
  it("uses a confirmed payday even when an unconfirmed one lands earlier", () => {
    const result = selectPayday(
      [
        { nextDate: "2026-09-11", cadence: "biweekly", confirmed: false, landsOnSpendable: true, direction: "income" },
        { nextDate: "2026-09-15", cadence: "twice_monthly", confirmed: true, landsOnSpendable: true, direction: "income" },
      ],
      TODAY,
    );
    assert.equal(result.paydayDate, "2026-09-15");
    assert.equal(result.provisional, false);
  });

  it("falls back to the earliest detected payday, provisional", () => {
    const result = selectPayday(
      [{ nextDate: "2026-09-11", cadence: "biweekly", confirmed: false, landsOnSpendable: true, direction: "income" }],
      TODAY,
    );
    assert.equal(result.paydayDate, "2026-09-11");
    assert.equal(result.provisional, true);
  });

  it("ignores income that does not land on spendable accounts and non-payroll cadences", () => {
    const result = selectPayday(
      [
        { nextDate: "2026-09-11", cadence: "biweekly", confirmed: false, landsOnSpendable: false, direction: "income" },
        { nextDate: "2026-10-11", cadence: "annual", confirmed: true, landsOnSpendable: true, direction: "income" },
      ],
      TODAY,
    );
    assert.equal(result.paydayDate, null);
    assert.equal(result.provisional, true);
  });
});

describe("WP3 — comparable-period margin", () => {
  const observed: CalcObservedTxn[] = [
    { date: "2026-08-01", amountCents: 200000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-20", amountCents: 200000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-08-28", amountCents: -100000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-09-02", amountCents: 200000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
    { date: "2026-09-05", amountCents: -30000, accountId: CHECKING, accountRole: "spending_source", accountIncluded: true, pending: false },
  ];

  it("compares the partial current month against the prior month through the same day", () => {
    const margins = computeMonthlyMargins(observed, TODAY);
    const september = margins.find((m) => m.month === "2026-09");
    assert.ok(september);
    assert.equal(september.marginCents, 170000);
    assert.equal(september.comparableMarginCents, 200000);
  });

  it("never compares a partial month against a full prior month", () => {
    const margins = computeMonthlyMargins(observed, TODAY);
    const august = margins.find((m) => m.month === "2026-08");
    assert.ok(august);
    assert.equal(august.marginCents, 300000);
    assert.equal(august.comparableMarginCents, undefined);
  });
});

describe("WP3 — net worth", () => {
  it("sums included assets minus liabilities", () => {
    const net = computeNetWorth([
      account(CHECKING, "spending_source", 120000),
      account(SAVINGS, "reserve", 360000, true),
      account("broker", "investment", 500000),
      account(CARD, "credit_liability", -30000),
      account("car", "loan", -200000),
    ]);
    assert.equal(net.assetCents, 980000);
    assert.equal(net.liabilityCents, 230000);
    assert.equal(net.netCents, 750000);
    assert.equal(net.accountsIncluded, 5);
    assert.equal(net.accountsMissingBalance, 0);
  });

  it("counts accounts with unknown balances instead of treating them as zero", () => {
    const net = computeNetWorth([
      account(CHECKING, "spending_source", 120000),
      { id: "mystery", role: "investment", included: true, spendableCents: null, balanceAsOf: null, isEmergency: false },
    ]);
    assert.equal(net.netCents, 120000);
    assert.equal(net.accountsMissingBalance, 1);
    assert.equal(net.accountsIncluded, 1);
  });

  it("excludes ignored accounts entirely", () => {
    const net = computeNetWorth([
      account(CHECKING, "spending_source", 120000),
      { id: "biz", role: "ignore", included: true, spendableCents: 900000, balanceAsOf: null, isEmergency: false },
    ]);
    assert.equal(net.netCents, 120000);
  });
});

describe("WP5 — subscription detection heuristic", () => {
  const candidate = (overrides: Partial<Parameters<typeof looksLikeSubscription>[0]> = {}) => ({
    direction: "expense" as const,
    descriptionPattern: "streaming service",
    cadence: "monthly" as const,
    amountCents: 1499,
    flowKind: "standard" as const,
    ...overrides,
  });

  it("proposes regular service charges as subscriptions", () => {
    assert.equal(looksLikeSubscription(candidate()), true);
    assert.equal(looksLikeSubscription(candidate({ cadence: "annual", amountCents: 17999 })), true);
    assert.equal(looksLikeSubscription(candidate({ cadence: "quarterly", amountCents: 4500 })), true);
  });

  it("never proposes household bills, transfers, or card payments as subscriptions", () => {
    assert.equal(looksLikeSubscription(candidate({ descriptionPattern: "city electric utility" })), false);
    assert.equal(looksLikeSubscription(candidate({ descriptionPattern: "rent payment main st" })), false);
    assert.equal(looksLikeSubscription(candidate({ descriptionPattern: "auto insurance policy" })), false);
    assert.equal(looksLikeSubscription(candidate({ flowKind: "card_payment" })), false);
    assert.equal(looksLikeSubscription(candidate({ flowKind: "internal_transfer" })), false);
  });

  it("excludes income and non-service cadences and out-of-band amounts", () => {
    assert.equal(looksLikeSubscription(candidate({ direction: "income" })), false);
    assert.equal(looksLikeSubscription(candidate({ cadence: "weekly" })), false);
    assert.equal(looksLikeSubscription(candidate({ amountCents: 25 })), false);
    assert.equal(looksLikeSubscription(candidate({ amountCents: 120000 })), false);
  });

  it("a user-confirmed review status survives the merge", () => {
    const merged = mergeRecurringItems(
      [],
      [persistedRowFixture({ isSubscription: true, reviewStatus: "keep" })],
      TODAY,
      null,
    );
    assert.equal(merged[0].isSubscription, true);
    assert.equal(merged[0].reviewStatus, "keep");
  });
});

function persistedRowFixture(overrides: Partial<PersistedRecurringItem> = {}): PersistedRecurringItem {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    stableKey: "expense|streaming service|15",
    direction: "expense",
    merchant: "Streaming service",
    descriptionPattern: "streaming service",
    amountCents: 1499,
    cadence: "monthly",
    nextDate: "2026-09-15",
    anchorDaysOfMonth: [15],
    accountIds: [CHECKING],
    included: true,
    confirmedAt: "2026-09-08T10:00:00Z",
    flowKind: "standard",
    counterpartyAccountIds: [],
    isSubscription: false,
    reviewStatus: null,
    lastSeenDate: "2026-08-15",
    source: "detected",
    ...overrides,
  };
}

describe("fallback payday window", () => {
  it("uses a provisional 14-day window when no payday is known", () => {
    const snap = computeCashflow(baseInput({ paydayDate: null }));
    assert.equal(snap.paydayWindow.nextPayday, null);
    assert.equal(snap.paydayWindow.end, "2026-09-22");
    assert.equal(snap.paydayWindow.provisional, true);
  });

  it("never lets a payday on or before today produce an empty window", () => {
    const snap = computeCashflow(baseInput({ paydayDate: TODAY }));
    assert.equal(snap.paydayWindow.end, "2026-09-22");
  });

  it("availability over an explicit window matches the daily simulation", () => {
    const sim = simulate(baseInput({ recurring: [item("net", "Internet", 8000, "expense", "monthly", "2026-08-10", [CHECKING], { anchorDaysOfMonth: [10] })] }));
    const result = availabilityInWindow(sim, "2026-09-17", 25000);
    assert.equal(result.lowCents, 112000);
    assert.equal(result.availableCents, 87000);
  });
});
