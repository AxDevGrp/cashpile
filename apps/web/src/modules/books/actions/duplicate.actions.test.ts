import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, any>;

function loadActions(rows: Row[], options: { race?: boolean; error?: string } = {}) {
  const writes: { type: string; ids?: string[]; value?: Row }[] = [];
  const revalidated: string[] = [];
  const project = (row: Row, fields = "") => Object.fromEntries(fields.split(",").map((field) => field.trim()).filter(Boolean).map((field) => [field, row[field]]));
  const result = (table: string, state: Row) => {
    if (options.error) return { data: null, error: { message: options.error } };
    if (state.kind === "select") {
      const source = table === "books_transactions" ? rows : [];
      const found = source.filter((row) => (!state.ids || state.ids.includes(row.id)) && (state.id === undefined || row.id === state.id) && (state.userId === undefined || row.user_id === state.userId));
      return { data: found.map((row) => project(row, state.fields)), error: null };
    }
    if (state.kind === "update") {
      writes.push({ type: "update", ids: state.ids, value: state.value });
      return { data: null, error: null };
    }
    if (state.kind === "delete") {
      if (options.race && !state.nullPlaidOnly) return { data: null, error: { message: "RACE_GUARD_REQUIRED" } };
      if (options.race) for (const row of rows) if (state.ids?.includes(row.id)) row.plaid_transaction_id = "newly-linked";
      const deleted = rows.filter((row) => state.ids?.includes(row.id) && (state.id === undefined || row.id === state.id) && (state.userId === undefined || row.user_id === state.userId) && (!state.nullPlaidOnly || row.plaid_transaction_id == null));
      writes.push({ type: "delete", ids: deleted.map((row) => row.id) });
      return { data: state.fields ? deleted.map((row) => project(row, state.fields)) : null, error: null };
    }
    return { data: null, error: null };
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table: string) {
      const state: Row = {};
      const query: any = {
        select(fields: string) { state.kind ??= "select"; state.fields = fields; return query; },
        update(value: Row) { state.kind = "update"; state.value = value; return query; },
        delete() { state.kind = "delete"; return query; },
        eq(field: string, value: unknown) { if (field === "user_id") state.userId = value; if (field === "id") state.id = value; return query; },
        in(_: string, ids: string[]) { state.ids = ids; return query; },
        is(field: string, value: unknown) { if (field === "plaid_transaction_id" && value === null) state.nullPlaidOnly = true; return query; },
        order() { return query; },
        range() { return query; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result(table, state)).then(resolve); },
      };
      return query;
    },
  };
  const exports: Record<string, (...args: any[]) => Promise<any>> = {};
  const source = readFileSync(new URL("./duplicate.actions.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (name === "@cashpile/db") return { createServerSupabaseClient: async () => supabase };
      if (name === "next/cache") return { revalidatePath: (path: string) => revalidated.push(path) };
      if (name === "../services/duplicate-detection") return { normalizeTransactionDescription: (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ") };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { actions: exports, writes, revalidated };
}

const tx = (id: string, extra: Row = {}): Row => ({
  id, date: "2026-09-01", description: "Coffee Shop", merchant: null, amount: 12, category_id: null,
  financial_account_id: null, import_source: "csv", plaid_transaction_id: null, metadata: null,
  created_at: "2026-09-01T00:00:00Z", user_id: "owner", ...extra,
});

describe("duplicate merge safety", () => {
  it("ranks a bank-linked transaction ahead of a more complete CSV row", async () => {
    const { actions } = loadActions([
      tx("csv", { category_id: "food", financial_account_id: "account", merchant: "Coffee" }),
      tx("bank", { financial_account_id: "account", plaid_transaction_id: "plaid", import_source: "plaid" }),
    ]);
    const [group] = await actions.listDuplicateReviewGroups();
    assert.equal(group.transactions[0].id, "bank");
  });

  it("rejects a bank-linked duplicate before a single merge writes", async () => {
    const test = loadActions([tx("keeper"), tx("bank", { plaid_transaction_id: "plaid" })]);
    await assert.rejects(test.actions.mergeDuplicateTransactions("keeper", ["bank"]), /bank-linked|plaid/i);
    assert.deepEqual(test.writes, []);
  });

  it("rejects a bank-linked duplicate before a bulk merge writes", async () => {
    const test = loadActions([tx("keeper"), tx("bank", { plaid_transaction_id: "plaid" })]);
    await assert.rejects(test.actions.bulkMergeDuplicateGroups([{ keeperId: "keeper", duplicateIds: ["bank"] }]), /bank-linked|plaid/i);
    assert.deepEqual(test.writes, []);
  });

  it("rejects direct deletion of a bank-linked transaction before writes", async () => {
    const test = loadActions([tx("bank", { plaid_transaction_id: "plaid" })]);
    await assert.rejects(test.actions.deleteDuplicateTransactions(["bank"]), /bank-linked|plaid/i);
    assert.deepEqual(test.writes, []);
  });

  it("copies a CSV category to the bank keeper", async () => {
    const test = loadActions([tx("bank", { plaid_transaction_id: "plaid", import_source: "plaid" }), tx("csv", { category_id: "food" })]);
    assert.equal((await test.actions.mergeDuplicateTransactions("bank", ["csv"])).merged, 1);
    assert.equal(test.writes[0].value?.category_id, "food");
  });

  it("blocks merging two bank identities rather than discarding one", async () => {
    const test = loadActions([tx("keeper", { plaid_transaction_id: "bank-one" }), tx("duplicate", { plaid_transaction_id: "bank-two" })]);
    await assert.rejects(test.actions.mergeDuplicateTransactions("keeper", ["duplicate"]), /bank-linked/i);
    assert.deepEqual(test.writes, []);
  });

  it("keeps the existing keeper category and deduplicates merge IDs", async () => {
    const test = loadActions([tx("keeper", { category_id: "existing" }), tx("csv", { category_id: "other" })]);
    assert.equal((await test.actions.bulkMergeDuplicateGroups([{ keeperId: "keeper", duplicateIds: ["keeper", "csv", "csv"] }])).merged, 1);
    assert.equal(test.writes[0].value?.category_id, undefined);
    assert.deepEqual(test.writes[1], { type: "delete", ids: ["csv"] });
  });

  it("rejects missing requested rows without writes", async () => {
    const test = loadActions([tx("keeper")]);
    await assert.rejects(test.actions.mergeDuplicateTransactions("keeper", ["missing", "missing"]), /not found|changed/i);
    assert.deepEqual(test.writes, []);
  });

  it("rejects a requested row owned by somebody else without writes", async () => {
    const test = loadActions([tx("keeper"), tx("other", { user_id: "other-owner" })]);
    await assert.rejects(test.actions.mergeDuplicateTransactions("keeper", ["other"]), /not found|changed/i);
    assert.deepEqual(test.writes, []);
  });

  it("rejects a missing direct-delete row without writes", async () => {
    const test = loadActions([]);
    await assert.rejects(test.actions.deleteDuplicateTransactions(["missing"]), /not found|changed/i);
    assert.deepEqual(test.writes, []);
  });

  it("uses the guarded delete result for unique requested IDs", async () => {
    const test = loadActions([tx("csv")]);
    assert.equal((await test.actions.deleteDuplicateTransactions(["csv", "csv"])).deleted, 1);
    assert.deepEqual(test.writes, [{ type: "delete", ids: ["csv"] }]);
  });

  it("fails when a row becomes bank-linked between review and deletion", async () => {
    const test = loadActions([tx("keeper"), tx("csv")], { race: true });
    await assert.rejects(test.actions.mergeDuplicateTransactions("keeper", ["csv"]), /changed/i);
  });

  it("does not report direct deletion when a row becomes bank-linked", async () => {
    const test = loadActions([tx("csv")], { race: true });
    await assert.rejects(test.actions.deleteDuplicateTransactions(["csv"]), /changed/i);
    assert.deepEqual(test.writes, [{ type: "delete", ids: [] }]);
  });

  it("surfaces database errors", async () => {
    await assert.rejects(loadActions([tx("csv")], { error: "database unavailable" }).actions.listDuplicateReviewGroups(), /database unavailable/);
  });
});
