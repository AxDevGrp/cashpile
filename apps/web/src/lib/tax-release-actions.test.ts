import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the actual server actions with auth/database boundaries replaced.
// Any database access is an error: restricted requests must stop before a query.
function loadActions(file: string, taxEnabled = false) {
  const user = { id: "test-user", email: "person@example.com", email_confirmed_at: "2026-09-09" };
  const assertAccess = () => { if (!taxEnabled) throw new Error("This feature is not available."); };
  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => { throw new Error("DATABASE_REACHED"); },
  };
  const exports: Record<string, (...args: any[]) => Promise<any>> = {};
  const source = readFileSync(new URL(`../modules/books/actions/${file}.actions.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (name === "@cashpile/db") return { createServerSupabaseClient: async () => supabase };
      if (name === "@/lib/tax-access") return {
        hasTaxTestingAccess: () => taxEnabled,
        assertTaxTestingAccess: assertAccess,
        requireTaxTestingAccess: async () => assertAccess(),
      };
      return {};
    },
  });
  return exports;
}

describe("tax server-action release boundary", () => {
  it("returns no entity options to public cleanup screens", async () => {
    assert.equal((await loadActions("entity").listTaxEntities()).length, 0);
  });
  it("blocks tax reads, assignments, and exports before database work", async () => {
    const tax = loadActions("tax");
    await assert.rejects(tax.listTaxViews("entity"), /not available/);
    await assert.rejects(tax.assignTransactions({ taxEntityId: "entity", transactionIds: ["transaction"] }), /not available/);
    await assert.rejects(tax.unassignTransactions({ taxEntityId: "entity", transactionIds: ["transaction"] }), /not available/);
    await assert.rejects(loadActions("tax-workbook").listTaxWorkbookTemplates(), /not available/);
    await assert.rejects(loadActions("entity").createTaxEntity({ name: "Business" }), /not available/);
  });
  it("blocks tax assignment through otherwise public account and AI actions", async () => {
    const accounts = loadActions("account");
    await assert.rejects(accounts.assignAccountToTaxEntity("account", "entity"), /not available/);
    await assert.rejects(accounts.backfillAssignedAccountTaxViews(), /not available/);
    await assert.rejects(accounts.createAccount({ name: "Checking", tax_entity_id: "entity" }), /not available/);
    await assert.rejects(accounts.updateAccount("account", { tax_entity_id: null }), /not available/);
    const ai = loadActions("ai-review");
    await assert.rejects(ai.acceptAiReviewSuggestion({ transactionIds: ["transaction"], taxEntityId: "entity" }), /not available/);
    await assert.rejects(ai.applyAiInstruction({ instruction: "Assign this account", setAccountDefault: true }), /not available/);
    await assert.rejects(loadActions("import").executeImport("csv", "account", "entity"), /not available/);
  });
  it("does not block normal account creation, and preserves tester access", async () => {
    await assert.rejects(loadActions("account").createAccount({ name: "Checking" }), /DATABASE_REACHED/);
    await assert.rejects(loadActions("tax", true).listTaxViews("entity"), /DATABASE_REACHED/);
    await assert.rejects(loadActions("tax-workbook", true).listTaxWorkbookTemplates(), /DATABASE_REACHED/);
  });
});
