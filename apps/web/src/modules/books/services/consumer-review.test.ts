import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ReviewError,
  decodeCursor,
  encodeCursor,
  listConsumerReview,
  listReviewInputSchema,
  mapRpcError,
  saveConsumerReview,
  saveReviewInputSchema,
  toSafeCount,
} from "./consumer-review.ts";

const TX = "aaaaaaaa-0000-0000-0000-000000000001";

function fakeClient(handlers: Record<string, () => { data: any; error: any }>) {
  const calls: { name: string; args: any }[] = [];
  return {
    calls,
    async rpc(name: string, args: any) {
      calls.push({ name, args });
      const handler = handlers[name];
      return handler ? handler() : { data: null, error: null };
    },
  };
}

describe("review payload validation", () => {
  it("rejects extra keys and invalid list bounds", () => {
    assert.equal(listReviewInputSchema.safeParse({ limit: 0 }).success, false);
    assert.equal(listReviewInputSchema.safeParse({ limit: 51 }).success, false);
    assert.equal(listReviewInputSchema.safeParse({ accountId: "not-a-uuid" }).success, false);
    assert.equal(listReviewInputSchema.safeParse({ extra: true }).success, false);
    assert.equal(listReviewInputSchema.safeParse({ limit: 20 }).success, true);
  });

  it("rejects invalid enum, non-integer revision, NaN and extra keys on save", () => {
    const base = { transactionId: TX, expectedRevision: 1, kind: "spend", categoryId: null, remember: false };
    assert.equal(saveReviewInputSchema.safeParse(base).success, true);
    assert.equal(saveReviewInputSchema.safeParse({ ...base, kind: "transfer" }).success, false);
    assert.equal(saveReviewInputSchema.safeParse({ ...base, expectedRevision: 1.5 }).success, false);
    assert.equal(saveReviewInputSchema.safeParse({ ...base, categoryId: Number.NaN }).success, false);
    assert.equal(saveReviewInputSchema.safeParse({ ...base, userId: "x" }).success, false);
  });
});

describe("cursors", () => {
  it("round-trips the four typed sort keys", () => {
    const cursor = { up: false, abs: 115000, date: "2026-09-15", id: TX };
    const encoded = encodeCursor(cursor);
    assert.ok(encoded);
    assert.deepEqual(decodeCursor(encoded), cursor);
    assert.equal(decodeCursor(null), null);
  });

  it("rejects oversized or malformed cursors as invalid_input", () => {
    assert.throws(() => decodeCursor("x".repeat(2000)), ReviewError);
    assert.throws(() => decodeCursor(Buffer.from('{"up":true}').toString("base64url")), ReviewError);
    assert.throws(
      () => decodeCursor(Buffer.from('{"up":true,"abs":1,"date":"2026-01-01","id":"x","z":1}').toString("base64url")),
      ReviewError
    );
  });
});

describe("error and count mapping", () => {
  it("maps SQL codes to statuses", () => {
    assert.equal(mapRpcError("revision_conflict").status, 409);
    assert.equal(mapRpcError("not_found").status, 404);
    assert.equal(mapRpcError("invalid_input").status, 400);
    assert.equal(mapRpcError("some pg error").status, 503);
  });

  it("range-checks bigint counts", () => {
    assert.equal(toSafeCount(4), 4);
    assert.equal(toSafeCount("129000"), 129000);
    assert.throws(() => toSafeCount(-1), ReviewError);
    assert.throws(() => toSafeCount("9007199254740993"), ReviewError);
  });
});

describe("review service", () => {
  it("lists a page and pairs it with the unfiltered summary", async () => {
    const client = fakeClient({
      consumer_review_page: () => ({
        data: {
          items: [
            { transactionId: TX, revision: 1, date: "2026-09-15", description: "Rent", amountCents: -115000, accountId: "a", accountLabel: "A Checking", kind: "unknown", categoryId: null, suggestion: null },
          ],
          nextCursor: { up: false, abs: 115000, date: "2026-09-15", id: TX },
        },
        error: null,
      }),
      consumer_review_summary: () => ({ data: { count: 4, debitCents: 129000, creditCents: 200000 }, error: null }),
    });

    const page = await listConsumerReview(client, "user-1", { limit: 2 });
    assert.equal(page.total, 4);
    assert.equal(page.debitCents, 129000);
    assert.equal(page.creditCents, 200000);
    assert.equal(page.items.length, 1);
    assert.ok(page.nextCursor);
  });

  it("throws a 404 ReviewError for a foreign id on save", async () => {
    const client = fakeClient({
      consumer_save_review: () => ({ data: null, error: { message: "not_found" } }),
    });
    await assert.rejects(
      () => saveConsumerReview(client, "user-1", { transactionId: TX, expectedRevision: 1, kind: "spend", categoryId: 5, remember: true }),
      (err: unknown) => err instanceof ReviewError && err.status === 404
    );
  });

  it("returns the saved item with a fresh summary", async () => {
    const client = fakeClient({
      consumer_save_review: () => ({ data: { transactionId: TX, revision: 2, reviewRequired: false }, error: null }),
      consumer_review_summary: () => ({ data: { count: 3, debitCents: 14000, creditCents: 200000 }, error: null }),
    });
    const result = await saveConsumerReview(client, "user-1", {
      transactionId: TX,
      expectedRevision: 1,
      kind: "spend",
      categoryId: 5,
      remember: false,
    });
    assert.deepEqual(result.item, { transactionId: TX, revision: 2, reviewRequired: false });
    assert.equal(result.review.count, 3);
  });
});
