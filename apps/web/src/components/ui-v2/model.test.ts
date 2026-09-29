import assert from "node:assert/strict";
import test from "node:test";

import {
  getAppNavigation,
  getConsumerActiveHref,
  isMobileNavigationItem,
  isUiV2Enabled,
  matchesNavigationPath,
  selectActiveNavigationHref,
  selectPriorityInsight,
} from "./model.ts";

test("UI V2 feature flag only enables explicit truthy values", () => {
  for (const value of ["1", "true", "yes", "on", "TRUE", " Yes "]) {
    assert.equal(isUiV2Enabled(value), true);
  }

  for (const value of [undefined, "", "0", "false", "enabled", " true-ish "]) {
    assert.equal(isUiV2Enabled(value), false);
  }
});

test("navigation matching supports exact and nested routes", () => {
  assert.equal(matchesNavigationPath("/books", "/books"), true);
  assert.equal(matchesNavigationPath("/books", "/books/accounts"), true);
  assert.equal(matchesNavigationPath("/books", "/bookkeeping"), false);
  assert.equal(matchesNavigationPath("/", "/books"), false);
});

test("app navigation only exposes Tax when enabled and keeps mobile routes stable", () => {
  assert.deepEqual(getAppNavigation(false), [
    { href: "/cashboard", label: "Home", mobile: true },
    { href: "/ai", label: "Ask Cash", mobile: true },
    { href: "/cashflow", label: "Activity", mobile: true },
    { href: "/books", label: "Books", mobile: true },
    { href: "/settings", label: "Settings", mobile: true },
    { href: "/pulse/alerts", label: "Notifications", mobile: false },
  ]);

  assert.deepEqual(getAppNavigation(true), [
    { href: "/cashboard", label: "Home", mobile: true },
    { href: "/ai", label: "Ask Cash", mobile: true },
    { href: "/cashflow", label: "Activity", mobile: true },
    { href: "/books", label: "Books", mobile: true },
    { href: "/books/tax", label: "Tax", mobile: false },
    { href: "/settings", label: "Settings", mobile: true },
    { href: "/pulse/alerts", label: "Notifications", mobile: false },
  ]);
});

test("most-specific active navigation href wins", () => {
  const navigation = getAppNavigation(true);

  assert.equal(selectActiveNavigationHref(navigation, "/books/tax"), "/books/tax");
  assert.equal(selectActiveNavigationHref(navigation, "/books/accounts"), "/books");
});

test("preview navigation remains visible on mobile unless explicitly hidden", () => {
  assert.equal(isMobileNavigationItem({}), true);
  assert.equal(isMobileNavigationItem({ mobile: false }), false);
});

test("priority selection is deterministic for equal severity insights", () => {
  const selected = selectPriorityInsight([
    { id: "later", severity: "attention", title: "Later" },
    { id: "first", severity: "attention", title: "First" },
    { id: "low", severity: "info", title: "Low" },
  ]);

  assert.equal(selected?.id, "later");
  assert.equal(selectPriorityInsight([]), undefined);
});

test("consumer navigation is exactly three primary items", () => {
  assert.deepEqual(getAppNavigation(false, true), [
    { href: "/cashboard", label: "Cashboard", mobile: true },
    { href: "/books/transactions", label: "Activity", mobile: true },
    { href: "/books/accounts", label: "Accounts", mobile: true },
  ]);
  assert.equal(getAppNavigation(false, true).length, 3);
});

test("consumer primary selection maps cashflow and nested routes", () => {
  assert.equal(getConsumerActiveHref("/cashboard"), "/cashboard");
  assert.equal(getConsumerActiveHref("/cashflow"), "/cashboard");
  assert.equal(getConsumerActiveHref("/cashflow/what-if"), "/cashboard");
  assert.equal(getConsumerActiveHref("/books/transactions"), "/books/transactions");
  assert.equal(getConsumerActiveHref("/books/transactions/ai-review"), "/books/transactions");
  assert.equal(getConsumerActiveHref("/books/accounts"), "/books/accounts");
  assert.equal(getConsumerActiveHref("/settings"), undefined);
  assert.equal(getConsumerActiveHref("/ai"), undefined);
});
