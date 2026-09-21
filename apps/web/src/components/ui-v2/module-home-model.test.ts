import assert from "node:assert/strict";
import test from "node:test";

import {
  getModuleHomeDefinition,
  moduleHomeIds,
  shouldRenderModuleEntrance,
} from "./module-home-model.ts";

test("module entrances respect the flag and details view", () => {
  assert.equal(shouldRenderModuleEntrance(true, undefined), true);
  assert.equal(shouldRenderModuleEntrance(true, "details"), false);
  assert.equal(shouldRenderModuleEntrance(false, undefined), false);
});

test("module definitions retain exact action order and detail destinations", () => {
  const expected = {
    cashflow: ["/cashflow?view=details", "/cashflow/recurring", "/books/transactions", "/cashboard"],
    subscriptions: ["/cashflow/recurring?view=details", "/cashflow", "/books/transactions", "/cashboard"],
    books: ["/books/transactions", "/books/transactions?filter=uncategorized", "/books/transactions/ai-review", "/books/transactions/import"],
    tax: ["/books/tax?view=details", "/books/entities", "/books/transactions", "/books/reports"],
    trades: ["/trades/accounts", "/trades/journal", "/trades/journal/new", "/trades/performance"],
    pulse: ["/pulse/alerts", "/pulse/events", "/pulse/watchlist", "/pulse/correlations"],
  };
  const detailsHrefs = {
    cashflow: "/cashflow?view=details",
    subscriptions: "/cashflow/recurring?view=details",
    books: "/books?view=details",
    tax: "/books/tax?view=details",
    trades: "/trades?view=details",
    pulse: "/pulse?view=details",
  };

  assert.deepEqual(moduleHomeIds, Object.keys(expected));
  for (const id of moduleHomeIds) {
    const definition = getModuleHomeDefinition(id);
    assert.deepEqual(definition.actions.map(({ href }) => href), expected[id]);
    assert.equal(definition.detailsHref, detailsHrefs[id]);
    assert.ok(definition.actions.length >= 3 && definition.actions.length <= 4);
    assert.equal(definition.actions.some(({ href }) => href === "/trades/metrics"), false);
  }
});
