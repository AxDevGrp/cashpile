/**
 * Transfer Detection — Books module
 * Adapted from stacks/src/lib/transfer-detection.ts
 * Detects transfers via keyword/regex/institution patterns and amount-date pairing.
 */

import type { ImportedTransaction } from "../types";

// ─── Patterns ─────────────────────────────────────────────────────────────

const TRANSFER_KEYWORDS = [
  "transfer", "transfer to", "transfer from", "online transfer", "funds transfer",
  "acct transfer", "account transfer", "internal transfer", "ach transfer", "wire transfer",
  "electronic transfer", "ext transfer", "external transfer", "deposit transfer",
  "withdrawal transfer", "move money", "transfer in", "transfer out",
  "tfr to", "tfr from", "xfer to", "xfer from",
];

const TRANSFER_REGEX: RegExp[] = [
  /transfer\s+(?:to|from)\s+/i,
  /(?:online|electronic|ach|wire)\s+transfer/i,
  /acct\s*(?:transfer|xfer)/i,
  /(?:internal|external)\s+transfer/i,
  /(?:deposit|withdrawal)\s+transfer/i,
  /(?:tfr|xfer)\s+(?:to|from)/i,
  /move\s+money/i,
  /funds?\s+transfer/i,
];

const INSTITUTION_REGEX: Record<string, RegExp[]> = {
  chase: [/chase\s+quickpay/i, /chase\s+online/i, /online\s+banking\s+transfer/i],
  bofa: [/bank\s+of\s+america\s+transfer/i, /bofa\s+transfer/i, /online\s+banking\s+xfer/i],
  wells: [/wells\s+fargo\s+transfer/i, /wf\s+online/i],
  citi: [/citibank\s+transfer/i, /citi\s+online/i],
};

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TransferDetectionResult {
  isTransfer: boolean;
  confidence: number;
  pattern?: string;
  matchedKeywords: string[];
  detectionMethod: "keyword" | "regex" | "institution" | "amount_date";
}

export interface TransferDetectionCriteria {
  amountTolerance: number;
  dateRangeDays: number;
  descriptionSimilarityThreshold: number;
  minimumConfidence: number;
}

export const DEFAULT_CRITERIA: TransferDetectionCriteria = {
  amountTolerance: 0.01,
  dateRangeDays: 3,
  descriptionSimilarityThreshold: 0.3,
  minimumConfidence: 0.7,
};

// ─── Core functions ────────────────────────────────────────────────────────

export function detectTransferPattern(tx: ImportedTransaction): TransferDetectionResult {
  const text = `${tx.description} ${tx.merchant ?? ""}`.toLowerCase();

  const result: TransferDetectionResult = {
    isTransfer: false,
    confidence: 0,
    matchedKeywords: [],
    detectionMethod: "keyword",
  };

  // Institution patterns (highest confidence)
  for (const [, patterns] of Object.entries(INSTITUTION_REGEX)) {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        return { isTransfer: true, confidence: 0.95, pattern: m[0], matchedKeywords: [], detectionMethod: "institution" };
      }
    }
  }

  // Regex patterns
  for (const p of TRANSFER_REGEX) {
    const m = text.match(p);
    if (m) {
      result.isTransfer = true;
      result.confidence = Math.max(result.confidence, 0.85);
      result.pattern = m[0];
      result.detectionMethod = "regex";
    }
  }

  // Keywords
  const matched = TRANSFER_KEYWORDS.filter((k) => text.includes(k));
  if (matched.length > 0) {
    result.isTransfer = true;
    result.matchedKeywords = matched;
    result.confidence = Math.max(result.confidence, Math.min(0.9, 0.5 + matched.length * 0.2));
    result.pattern = result.pattern ?? matched[0];
    if (result.detectionMethod === "keyword") result.detectionMethod = "keyword";
  }

  return result;
}

function descSimilarity(a: string, b: string): number {
  const w1 = a.toLowerCase().split(/\s+/);
  const w2 = b.toLowerCase().split(/\s+/);
  if (a.toLowerCase() === b.toLowerCase()) return 1;
  const all = new Set([...w1, ...w2]);
  const common = w1.filter((w) => w2.includes(w));
  return common.length / all.size;
}

/**
 * Annotates parsed transactions with isTransfer flag.
 * Does both pattern detection (single-pass) and pair matching.
 */
export function annotateWithTransferFlags(
  transactions: ImportedTransaction[],
  criteria: TransferDetectionCriteria = DEFAULT_CRITERIA
): (ImportedTransaction & { isTransfer: boolean; transferConfidence?: number })[] {
  // Single-pass pattern detection
  const patternResults = transactions.map((tx) => detectTransferPattern(tx));

  // Pair matching — look for offsetting amounts within date window
  const pairSet = new Set<number>();
  for (let i = 0; i < transactions.length; i++) {
    if (pairSet.has(i)) continue;
    const txDate = new Date(transactions[i].date).getTime();
    const txAmt = Math.abs(transactions[i].amount);

    for (let j = i + 1; j < transactions.length; j++) {
      if (pairSet.has(j)) continue;
      const matchAmt = Math.abs(transactions[j].amount);
      const matchDate = new Date(transactions[j].date).getTime();
      const daysDiff = Math.abs(txDate - matchDate) / 86_400_000;

      if (
        Math.abs(txAmt - matchAmt) <= criteria.amountTolerance &&
        daysDiff <= criteria.dateRangeDays &&
        Math.sign(transactions[i].amount) !== Math.sign(transactions[j].amount)
      ) {
        const sim = descSimilarity(transactions[i].description, transactions[j].description);
        let confidence = 0.4; // amount match
        confidence += Math.max(0, 1 - daysDiff / criteria.dateRangeDays) * 0.3;
        confidence += Math.min(sim, 1) * 0.2;
        confidence += 0.1; // opposite signs bonus

        if (confidence >= criteria.minimumConfidence) {
          pairSet.add(i);
          pairSet.add(j);
          if (confidence > (patternResults[i].confidence ?? 0)) {
            patternResults[i] = { isTransfer: true, confidence, matchedKeywords: [], detectionMethod: "amount_date" };
          }
          if (confidence > (patternResults[j].confidence ?? 0)) {
            patternResults[j] = { isTransfer: true, confidence, matchedKeywords: [], detectionMethod: "amount_date" };
          }
        }
      }
    }
  }

  return transactions.map((tx, i) => ({
    ...tx,
    isTransfer: patternResults[i].isTransfer && patternResults[i].confidence >= criteria.minimumConfidence,
    transferConfidence: patternResults[i].confidence > 0 ? patternResults[i].confidence : undefined,
  }));
}
