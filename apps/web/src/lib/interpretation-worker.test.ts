import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interpretTransactionsOnce,
  isAuthorizedCronRequest,
  sanitizeModelResults,
} from "./interpretation-worker.ts";

function makeFakeClient(data: {
  jobs: any[];
  transactions: any[];
  interpretations?: any[];
  categories?: any[];
  rules?: any[];
}) {
  const rpcCalls: { name: string; args: any }[] = [];
  const rowsFor = (table: string): any[] => {
    if (table === "books_transactions") return data.transactions;
    if (table === "books_transaction_interpretations") return data.interpretations ?? [];
    if (table === "books_categories") return data.categories ?? [];
    if (table === "books_consumer_rules") return data.rules ?? [];
    return [];
  };
  const chain = (table: string) => {
    const builder: any = {
      select: () => builder,
      in: () => Promise.resolve({ data: rowsFor(table), error: null }),
      eq: () => Promise.resolve({ data: rowsFor(table), error: null }),
    };
    return builder;
  };
  const client = {
    rpcCalls,
    from: (table: string) => chain(table),
    async rpc(name: string, args: any) {
      rpcCalls.push({ name, args });
      if (name === "consumer_claim_jobs") return { data: data.jobs, error: null };
      return { data: {}, error: null };
    },
  };
  return client;
}

const baseJob = { transaction_id: "t1", user_id: "u1", source_revision: 1 };
const baseTx = {
  id: "t1",
  user_id: "u1",
  amount: -42.1,
  description: "Unknown merchant",
  merchant: null,
  provider_data: {},
  category_id: null,
  financial_account_id: "a1",
};
const baseInterp = { transaction_id: "t1", kind: "unknown", source: "unknown", revision: 1, suggestion: null };

describe("cron authorization", () => {
  it("rejects absent, empty and mismatched secrets", () => {
    assert.equal(isAuthorizedCronRequest(null, "s3cret"), false);
    assert.equal(isAuthorizedCronRequest("nope", "s3cret"), false);
    assert.equal(isAuthorizedCronRequest("s3cret", ""), false);
    assert.equal(isAuthorizedCronRequest("s3cret", undefined), false);
  });

  it("accepts the exact configured secret", () => {
    assert.equal(isAuthorizedCronRequest("s3cret", "s3cret"), true);
  });
});

describe("interpretation worker", () => {
  it("makes zero model calls when background AI is disabled", async () => {
    const client = makeFakeClient({ jobs: [baseJob], transactions: [baseTx], interpretations: [baseInterp] });
    let modelCalls = 0;
    const result = await interpretTransactionsOnce({
      serviceClient: client,
      aiEnabled: false,
      categorize: async () => {
        modelCalls += 1;
        return [];
      },
    });

    assert.equal(modelCalls, 0);
    assert.equal(result.aiCalls, 0);
    assert.equal(result.applied, 1);
    const apply = client.rpcCalls.find((c) => c.name === "consumer_apply_interpretation");
    assert.equal(apply?.args.p_kind, "unknown");
    const finish = client.rpcCalls.find((c) => c.name === "consumer_finish_job");
    assert.equal(finish?.args.p_error_code, null);
  });

  it("applies a confident provider income fact deterministically", async () => {
    const tx = {
      ...baseTx,
      amount: 2000,
      description: "ACME PAYROLL",
      provider_data: {
        personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES", confidence_level: "VERY_HIGH" },
      },
    };
    const client = makeFakeClient({ jobs: [baseJob], transactions: [tx], interpretations: [baseInterp] });
    const result = await interpretTransactionsOnce({ serviceClient: client, aiEnabled: false });

    assert.equal(result.applied, 1);
    const apply = client.rpcCalls.find((c) => c.name === "consumer_apply_interpretation");
    assert.equal(apply?.args.p_kind, "income");
    assert.equal(apply?.args.p_source, "provider");
  });

  it("leaves rows unresolved for retry when the model fails or times out", async () => {
    const client = makeFakeClient({ jobs: [baseJob], transactions: [baseTx], interpretations: [baseInterp] });
    const result = await interpretTransactionsOnce({
      serviceClient: client,
      aiEnabled: true,
      categorize: async () => {
        throw new Error("model timeout");
      },
    });

    assert.equal(result.failed, 1);
    assert.equal(result.applied, 0);
    assert.equal(result.aiCalls, 1);
    assert.ok(!client.rpcCalls.some((c) => c.name === "consumer_apply_interpretation"));
    const finish = client.rpcCalls.find((c) => c.name === "consumer_finish_job");
    assert.equal(finish?.args.p_error_code, "model_error");
  });

  it("rejects a model result for another user's id or an unknown category", () => {
    const kept = sanitizeModelResults(
      [
        { transactionId: "t1", categoryId: 5, confidence: 0.9, kind: "unknown" },
        { transactionId: "foreign", categoryId: 5, confidence: 0.9, kind: "unknown" },
        { transactionId: "t1", categoryId: 5, confidence: 0.95, kind: "unknown" },
        { transactionId: "t1", categoryId: 999, confidence: 0.9, kind: "unknown" },
        { transactionId: "t1", categoryId: null, confidence: Number.NaN, kind: "unknown" },
      ],
      new Set(["t1"]),
      new Set([5])
    );

    assert.equal(kept.length, 1);
    assert.equal(kept[0].transactionId, "t1");
    assert.equal(kept[0].confidence, 0.9);
  });
});
