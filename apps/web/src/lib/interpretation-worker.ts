/**
 * Background interpretation worker (Stage 02).
 *
 * Bounded to one claim/run: claim ≤20 jobs for a single owner, resolve them with
 * deterministic precedence first, optionally consult the model once for the
 * remainder, and apply each decision through the source/interpretation-version
 * guarded RPC. No recursive drain; the primary schedules the route once/minute.
 */

import { randomUUID } from "node:crypto";
import {
  deriveConsumerInterpretation,
  type ConsumerInterpretation,
  type ConsumerKind,
  type ConsumerSuggestion,
  type ExactRuleMatch,
  type InterpretationRow,
} from "../modules/books/services/consumer-interpretation.ts";

export const CRON_SECRET_HEADER = "x-cron-secret";
export const MODEL_TIMEOUT_MS = 20_000;

export function isAuthorizedCronRequest(
  headerSecret: string | null | undefined,
  configuredSecret: string | null | undefined
): boolean {
  return typeof configuredSecret === "string" && configuredSecret.length > 0 && headerSecret === configuredSecret;
}

export interface JobRow {
  transaction_id: string;
  user_id: string;
  source_revision: number;
}

export interface ModelInputRow {
  id: string;
  description: string;
  merchant?: string;
  amount: number;
  type?: string;
}

export interface ModelResult {
  transactionId: string;
  categoryId: number | null;
  confidence: number;
  kind: ConsumerKind;
  reason?: string;
}

export type CategorizeBatch = (rows: ModelInputRow[]) => Promise<ModelResult[]>;

export interface InterpretationWorkerDeps {
  serviceClient: any;
  aiEnabled: boolean;
  categorize?: CategorizeBatch;
}

export interface InterpretationWorkerResult {
  claimed: number;
  applied: number;
  failed: number;
  aiCalls: number;
}

function normalizeDescription(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Keep only results that reference an ID we asked about and an allowed category,
 * have a finite confidence in [0,1], and produce at most one result per ID.
 */
export function sanitizeModelResults(
  results: ModelResult[],
  requestedIds: Set<string>,
  allowedCategoryIds: Set<number>
): ModelResult[] {
  const seen = new Set<string>();
  const kept: ModelResult[] = [];
  for (const result of results ?? []) {
    if (!result || !requestedIds.has(result.transactionId)) continue;
    if (seen.has(result.transactionId)) continue;
    if (typeof result.confidence !== "number" || !Number.isFinite(result.confidence)) continue;
    if (result.confidence < 0 || result.confidence > 1) continue;
    if (result.categoryId !== null && !allowedCategoryIds.has(result.categoryId)) continue;
    seen.add(result.transactionId);
    kept.push(result);
  }
  return kept;
}

async function loadContext(serviceClient: any, jobs: JobRow[]) {
  const ids = jobs.map((job) => job.transaction_id);
  const userId = jobs[0].user_id;

  const [txRes, interpRes, catRes, ruleRes] = await Promise.all([
    serviceClient
      .from("books_transactions")
      .select("id,user_id,amount,description,merchant,provider_data,category_id,financial_account_id")
      .in("id", ids),
    serviceClient
      .from("books_transaction_interpretations")
      .select("transaction_id,kind,source,revision,suggestion")
      .in("transaction_id", ids),
    serviceClient.from("books_categories").select("id,name,category_type").eq("user_id", userId),
    serviceClient.from("books_consumer_rules").select("financial_account_id,normalized_description,signed_amount_cents,kind,category_id").eq("user_id", userId),
  ]);

  return {
    transactions: new Map<string, any>((txRes.data ?? []).map((t: any) => [t.id, t])),
    interpretations: new Map<string, any>((interpRes.data ?? []).map((i: any) => [i.transaction_id, i])),
    categories: new Map<number, any>((catRes.data ?? []).map((c: any) => [Number(c.id), c])),
    rules: (ruleRes.data ?? []) as any[],
  };
}

function buildRow(tx: any, interpretation: any, categories: Map<number, any>): InterpretationRow {
  const categoryId = tx.category_id ?? null;
  const category = categoryId !== null ? categories.get(Number(categoryId)) : null;
  const providerCategory = tx.provider_data?.personal_finance_category ?? null;
  return {
    amountCents: Math.round(Number(tx.amount) * 100),
    description: tx.description ?? "",
    merchant: tx.merchant ?? null,
    provider: providerCategory
      ? {
          primary: providerCategory.primary ?? null,
          detailed: providerCategory.detailed ?? null,
          confidenceLevel: providerCategory.confidence_level ?? null,
        }
      : null,
    engineCategoryId: categoryId,
    engineCategoryConfident: category?.category_type === "expense",
    modelCategoryId: null,
    modelConfidence: null,
    existing: interpretation
      ? { kind: interpretation.kind, source: interpretation.source, categoryId }
      : null,
    sourceChanged: false,
  };
}

function matchExactRule(tx: any, amountCents: number, rules: any[]): ExactRuleMatch | null {
  const normalized = normalizeDescription(tx.description);
  const rule = rules.find(
    (r) =>
      r.financial_account_id === tx.financial_account_id &&
      r.normalized_description === normalized &&
      Number(r.signed_amount_cents) === amountCents
  );
  if (!rule) return null;
  return { kind: rule.kind, categoryId: rule.category_id ?? null };
}

async function applyAndFinish(
  serviceClient: any,
  token: string,
  job: JobRow,
  expectedRevision: number,
  interpretation: ConsumerInterpretation,
  categoryId: number | null,
  suggestion: unknown,
  errorCode: string | null,
  counters: { applied: number; failed: number }
) {
  if (errorCode) {
    counters.failed += 1;
    await serviceClient.rpc("consumer_finish_job", {
      p_transaction_id: job.transaction_id,
      p_token: token,
      p_source_revision: job.source_revision,
      p_error_code: errorCode,
    });
    return;
  }

  const applyRes = await serviceClient.rpc("consumer_apply_interpretation", {
    p_transaction_id: job.transaction_id,
    p_source_revision: job.source_revision,
    p_expected_revision: expectedRevision,
    p_kind: interpretation.kind,
    p_source: interpretation.source,
    p_suggestion: suggestion,
    p_category_id: categoryId,
  });

  if (applyRes?.error) {
    counters.failed += 1;
    return;
  }

  counters.applied += 1;
  await serviceClient.rpc("consumer_finish_job", {
    p_transaction_id: job.transaction_id,
    p_token: token,
    p_source_revision: job.source_revision,
    p_error_code: null,
  });
}

function makeDefaultCategorize(categories: Map<number, any>): CategorizeBatch {
  return async (rows: ModelInputRow[]): Promise<ModelResult[]> => {
    const { categorizeTransactions } = await import("@cashpile/ai");
    const catList = [...categories.values()].map((c) => ({ id: Number(c.id), name: String(c.name) }));
    const byName = new Map(catList.map((c) => [c.name, c.id]));
    const results = await categorizeTransactions(
      rows.map((r) => ({ id: r.id, description: r.description, merchant: r.merchant, amount: r.amount, type: r.type })),
      catList
    );
    return results.map((r) => ({
      transactionId: r.transactionId,
      categoryId: byName.get(r.categoryName) ?? null,
      confidence: r.confidence,
      kind: "unknown" as ConsumerKind,
      reason: r.method,
    }));
  };
}

export async function interpretTransactionsOnce(
  deps: InterpretationWorkerDeps
): Promise<InterpretationWorkerResult> {
  const counters = { claimed: 0, applied: 0, failed: 0, aiCalls: 0 };
  const token = randomUUID();

  const claim = await deps.serviceClient.rpc("consumer_claim_jobs", { p_token: token });
  if (claim?.error) return counters;
  const jobs: JobRow[] = claim?.data ?? [];
  counters.claimed = jobs.length;
  if (jobs.length === 0) return counters;

  const { transactions, interpretations, categories, rules } = await loadContext(deps.serviceClient, jobs);

  const deterministic: { job: JobRow; interpretation: ConsumerInterpretation; categoryId: number | null }[] = [];
  const unresolved: { job: JobRow; row: InterpretationRow }[] = [];

  for (const job of jobs) {
    const tx = transactions.get(job.transaction_id);
    if (!tx) {
      counters.failed += 1;
      await deps.serviceClient.rpc("consumer_finish_job", {
        p_transaction_id: job.transaction_id,
        p_token: token,
        p_source_revision: job.source_revision,
        p_error_code: "not_found",
      });
      continue;
    }

    const row = buildRow(tx, interpretations.get(job.transaction_id), categories);
    const exactRule = matchExactRule(tx, row.amountCents, rules);
    const category = exactRule?.categoryId != null ? categories.get(Number(exactRule.categoryId)) ?? null : null;
    const interpretation = deriveConsumerInterpretation(row, exactRule, category);

    if (interpretation.kind === "unknown" && deps.aiEnabled) {
      unresolved.push({ job, row });
    } else {
      const categoryId =
        interpretation.source === "rule"
          ? exactRule?.categoryId ?? null
          : interpretation.kind === "spend"
            ? row.engineCategoryId
            : null;
      deterministic.push({ job, interpretation, categoryId });
    }
  }

  for (const item of deterministic) {
    const expectedRevision = interpretations.get(item.job.transaction_id)?.revision ?? 1;
    await applyAndFinish(
      deps.serviceClient,
      token,
      item.job,
      expectedRevision,
      item.interpretation,
      item.categoryId,
      item.interpretation.suggestion,
      null,
      counters
    );
  }

  if (unresolved.length > 0) {
    counters.aiCalls = 1;
    let modelResults: ModelResult[] | null = null;
    try {
      const categorize = deps.categorize ?? makeDefaultCategorize(categories);
      modelResults = await categorize(
        unresolved.map(({ job, row }) => ({
          id: job.transaction_id,
          description: row.description,
          merchant: row.merchant ?? undefined,
          amount: row.amountCents / 100,
        }))
      );
    } catch {
      modelResults = null;
    }

    const requestedIds = new Set(unresolved.map(({ job }) => job.transaction_id));
    const allowedCategoryIds = new Set<number>([...categories.keys()].map(Number));
    const sanitized = modelResults
      ? new Map(sanitizeModelResults(modelResults, requestedIds, allowedCategoryIds).map((r) => [r.transactionId, r]))
      : null;

    for (const { job, row } of unresolved) {
      const expectedRevision = interpretations.get(job.transaction_id)?.revision ?? 1;
      if (sanitized === null) {
        // Model unavailable/timed out: leave the row unresolved for retry.
        await applyAndFinish(
          deps.serviceClient,
          token,
          job,
          expectedRevision,
          { kind: "unknown", source: "unknown", reviewRequired: true, suggestion: null },
          null,
          null,
          "model_error",
          counters
        );
        continue;
      }
      const model = sanitized.get(job.transaction_id);
      const suggestion: ConsumerSuggestion | null =
        model && model.categoryId !== null
          ? { kind: row.amountCents < 0 ? "spend" : "income", categoryId: model.categoryId, reason: "model_suggestion" }
          : null;
      await applyAndFinish(
        deps.serviceClient,
        token,
        job,
        expectedRevision,
        { kind: "unknown", source: "unknown", reviewRequired: true, suggestion },
        null,
        suggestion,
        null,
        counters
      );
    }
  }

  return counters;
}
