/**
 * Duplicate Detection — Books module
 *
 * Exact de-duplication uses a canonical SHA-256 fingerprint. Provider-backed
 * transactions should prefer provider IDs (for example Plaid transaction_id);
 * this fingerprint is for CSV, Excel, and manual entries.
 */

import { createHash } from "crypto";
import type { ImportedTransaction } from "../types";

// ─── Fingerprint helpers ───────────────────────────────────────────────────

export function normalizeTransactionDate(date: string): string {
  return date.trim().slice(0, 10);
}

export function normalizeTransactionAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

export function normalizeTransactionDescription(description: string): string {
  return description.toLowerCase().trim().replace(/\s+/g, " ");
}

export function buildTransactionFingerprint(tx: {
  financialAccountId?: string | null;
  accountId?: string | null;
  amount: number;
  date: string;
  description: string;
}): string {
  const raw = [
    tx.financialAccountId ?? tx.accountId ?? "unknown",
    normalizeTransactionDate(tx.date),
    normalizeTransactionAmount(tx.amount),
    normalizeTransactionDescription(tx.description),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

// Backward-compatible name for older call sites.
export function buildFingerprint(tx: { amount: number; date: string; description: string; financialAccountId?: string | null; accountId?: string | null }): string {
  return buildTransactionFingerprint(tx);
}

export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23505" || /duplicate key value violates unique constraint/i.test(error?.message ?? "");
}

// ─── Fuzzy matching (for review flags, not hard blocking) ───────────────────

export class FuzzyMatcher {
  static levenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: b.length + 1 }, (_, j) =>
      Array.from({ length: a.length + 1 }, (_, i) => (j === 0 ? i : i === 0 ? j : 0))
    );
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        matrix[j][i] =
          a[i - 1] === b[j - 1]
            ? matrix[j - 1][i - 1]
            : Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + 1);
      }
    }
    return matrix[b.length][a.length];
  }

  static similarityRatio(a: string, b: string): number {
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    return (max - this.levenshteinDistance(a.toLowerCase(), b.toLowerCase())) / max;
  }

  static tokenSetRatio(a: string, b: string): number {
    const s1 = new Set(normalizeTransactionDescription(a).split(/\s+/));
    const s2 = new Set(normalizeTransactionDescription(b).split(/\s+/));
    const intersection = [...s1].filter((w) => s2.has(w));
    const union = new Set([...s1, ...s2]);
    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  static combined(a: string, b: string): number {
    return this.similarityRatio(a, b) * 0.6 + this.tokenSetRatio(a, b) * 0.4;
  }
}

// ─── Pre-import duplicate check ────────────────────────────────────────────

/**
 * Given parsed transactions and existing fingerprints from the DB, annotate
 * each transaction with exact duplicate flags. `accountId` is part of the
 * fingerprint so same-day same-amount transactions in different accounts are
 * allowed.
 */
export function annotateWithDuplicateFlags(
  transactions: ImportedTransaction[],
  existingFingerprints: Set<string>,
  accountId?: string | null
): (ImportedTransaction & { fingerprint: string; isDuplicate: boolean })[] {
  const seen = new Set<string>();
  return transactions.map((tx) => {
    const fingerprint = buildTransactionFingerprint({ ...tx, financialAccountId: accountId });
    const isDuplicate = existingFingerprints.has(fingerprint) || seen.has(fingerprint);
    seen.add(fingerprint);
    return { ...tx, fingerprint, isDuplicate };
  });
}
