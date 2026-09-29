/**
 * Consumer review service (Stage 04).
 *
 * Normalizes and validates list/save arguments, calls the Stage 01 SQL
 * list/summary/save RPCs, and maps serialized Postgres error codes to HTTP
 * status. No model call, no SQL text built from user input.
 */

import { z } from "zod";

export const REVIEW_KINDS = [
  "unknown",
  "spend",
  "income",
  "passive_income",
  "refund",
  "internal_transfer",
  "card_payment",
  "asset_sale",
  "loan_proceeds",
] as const;

export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const MAX_CURSOR_BYTES = 1024;
export const MAX_BODY_BYTES = 8192;

export class ReviewError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "ReviewError";
    this.code = code;
    this.status = status;
  }
}

/** Map the SQL `consumer_raise` code (raised as the message) to a status. */
export function mapRpcError(message: string | null | undefined): ReviewError {
  const text = (message ?? "").toLowerCase();
  if (text.includes("revision_conflict")) return new ReviewError("revision_conflict", 409);
  if (text.includes("not_found")) return new ReviewError("not_found", 404);
  if (text.includes("invalid_input")) return new ReviewError("invalid_input", 400);
  return new ReviewError("unavailable", 503);
}

const uuid = z.string().uuid();

export const listReviewInputSchema = z
  .object({
    accountId: uuid.nullish(),
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().max(MAX_CURSOR_BYTES).nullish(),
  })
  .strict();

export const saveReviewInputSchema = z
  .object({
    transactionId: uuid,
    expectedRevision: z.number().int().positive(),
    kind: z.enum(REVIEW_KINDS),
    categoryId: z.number().int().nullish(),
    remember: z.boolean(),
  })
  .strict();

export type ListReviewInput = z.infer<typeof listReviewInputSchema>;
export type SaveReviewInput = z.infer<typeof saveReviewInputSchema>;

export interface ReviewItem {
  transactionId: string;
  revision: number;
  date: string;
  description: string;
  amountCents: number;
  accountId: string;
  accountLabel: string;
  kind: ReviewKind;
  categoryId: number | null;
  suggestion: unknown;
}

export interface ReviewSummary {
  count: number;
  debitCents: number;
  creditCents: number;
}

export interface ReviewPage extends ReviewSummary {
  items: ReviewItem[];
  nextCursor: string | null;
  total: number;
}

export function encodeCursor(cursor: unknown): string | null {
  if (cursor == null) return null;
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** Cursor contents are untrusted filters, never SQL fragments. */
export function decodeCursor(encoded: string | null | undefined): Record<string, unknown> | null {
  if (encoded == null || encoded === "") return null;
  if (Buffer.byteLength(encoded, "utf8") > MAX_CURSOR_BYTES) throw new ReviewError("invalid_input", 400);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new ReviewError("invalid_input", 400);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ReviewError("invalid_input", 400);
  }
  const keys = Object.keys(parsed as Record<string, unknown>);
  if (keys.length !== 4 || !["up", "abs", "date", "id"].every((k) => keys.includes(k))) {
    throw new ReviewError("invalid_input", 400);
  }
  return parsed as Record<string, unknown>;
}

/** Convert a bigint count to a safe JS number with a range check. */
export function toSafeCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(n)) {
    throw new ReviewError("unavailable", 503);
  }
  return n;
}

interface SupabaseLike {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ReviewError("invalid_input", 400);
  return result.data;
}

async function loadSummary(client: SupabaseLike, userId: string, accountId: string | null): Promise<ReviewSummary> {
  const { data, error } = await client.rpc("consumer_review_summary", {
    p_user_id: userId,
    p_account_id: accountId,
  });
  if (error) throw mapRpcError(error.message);
  return {
    count: toSafeCount(data?.count),
    debitCents: Number(data?.debitCents ?? 0),
    creditCents: Number(data?.creditCents ?? 0),
  };
}

export async function listConsumerReview(
  client: SupabaseLike,
  userId: string,
  input: unknown
): Promise<ReviewPage> {
  const parsed = parseOrThrow(listReviewInputSchema, input);
  const accountId = parsed.accountId ?? null;
  const after = decodeCursor(parsed.cursor);

  const { data, error } = await client.rpc("consumer_review_page", {
    p_user_id: userId,
    p_account_id: accountId,
    p_limit: parsed.limit ?? 20,
    p_after: after,
  });
  if (error) throw mapRpcError(error.message);

  const summary = await loadSummary(client, userId, accountId);
  return {
    ...summary,
    total: summary.count,
    items: (data?.items ?? []) as ReviewItem[],
    nextCursor: encodeCursor(data?.nextCursor),
  };
}

export async function saveConsumerReview(
  client: SupabaseLike,
  userId: string,
  input: unknown
): Promise<{ item: unknown; review: ReviewSummary }> {
  const parsed = parseOrThrow(saveReviewInputSchema, input);

  const { data, error } = await client.rpc("consumer_save_review", {
    p_transaction_id: parsed.transactionId,
    p_expected_revision: parsed.expectedRevision,
    p_kind: parsed.kind,
    p_category_id: parsed.categoryId ?? null,
    p_remember: parsed.remember,
  });
  if (error) throw mapRpcError(error.message);

  const review = await loadSummary(client, userId, null);
  return { item: data, review };
}
