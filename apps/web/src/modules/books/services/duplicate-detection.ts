/**
 * Duplicate Detection — Books module
 * Uses SHA-256 fingerprint of `amount|date|description` checked against
 * books_duplicate_fingerprints before insert (O(1) lookup, no fuzzy scan).
 * Fuzzy matching is available for post-import review.
 */

import { createHash } from "crypto";
import type { ImportedTransaction } from "../types";

// ─── Fingerprint helpers ───────────────────────────────────────────────────

export function buildFingerprint(tx: { amount: number; date: string; description: string }): string {
  const raw = `${tx.amount}|${tx.date}|${tx.description.toLowerCase().trim()}`;
  return createHash("sha256").update(raw).digest("hex");
}

// ─── Fuzzy matching (for post-import review UI) ────────────────────────────

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
    const s1 = new Set(a.toLowerCase().split(/\s+/));
    const s2 = new Set(b.toLowerCase().split(/\s+/));
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
 * Given a list of parsed transactions and existing fingerprints from the DB,
 * annotate each transaction with isDuplicate flag.
 */
export function annotateWithDuplicateFlags(
  transactions: ImportedTransaction[],
  existingFingerprints: Set<string>
): (ImportedTransaction & { fingerprint: string; isDuplicate: boolean })[] {
  const seen = new Set<string>();
  return transactions.map((tx) => {
    const fingerprint = buildFingerprint(tx);
    const isDuplicate = existingFingerprints.has(fingerprint) || seen.has(fingerprint);
    seen.add(fingerprint);
    return { ...tx, fingerprint, isDuplicate };
  });
}
