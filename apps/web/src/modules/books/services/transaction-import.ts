/**
 * Transaction Import Orchestrator — Books module
 * Pipeline: parse → exact dedup check → transfer flag → DB-enforced insert → tax rule assignment
 * AI categorization is triggered async after insert (non-blocking).
 */

"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { randomUUID } from "crypto";
import { addDays, formatISO, parseISO } from "date-fns";
import { CSVParser } from "./csv-parser";
import {
  FuzzyMatcher,
  annotateWithDuplicateFlags,
  buildTransactionFingerprint,
  isUniqueViolation,
} from "./duplicate-detection";
import { annotateWithTransferFlags } from "./transfer-detection";
import { autoAssignTaxEntities } from "./tax-rule-engine";
import type { ConfirmImportPayload, ImportPreview, ImportResult, ImportedTransaction } from "../types";

const FUZZY_DUPLICATE_THRESHOLD = 0.86;

type DuplicateCandidate = {
  id: string;
  description: string;
  amount: number;
  date: string;
};

function dateOnly(date: Date): string {
  return formatISO(date, { representation: "date" });
}

async function findPossibleDuplicateCandidate(
  supabase: any,
  userId: string,
  accountId: string,
  tx: ImportedTransaction
): Promise<{ id: string; confidence: number } | null> {
  const date = parseISO(tx.date);
  if (Number.isNaN(date.getTime())) return null;

  const { data, error } = await supabase
    .from("books_transactions")
    .select("id, description, amount, date")
    .eq("user_id", userId)
    .eq("financial_account_id", accountId)
    .eq("amount", Number(tx.amount).toFixed(2))
    .gte("date", dateOnly(addDays(date, -3)))
    .lte("date", dateOnly(addDays(date, 3)))
    .limit(25);

  if (error) return null;

  let best: { id: string; confidence: number } | null = null;
  for (const candidate of (data ?? []) as DuplicateCandidate[]) {
    const confidence = FuzzyMatcher.combined(tx.description, candidate.description);
    if (confidence >= FUZZY_DUPLICATE_THRESHOLD && (!best || confidence > best.confidence)) {
      best = { id: candidate.id, confidence };
    }
  }
  return best;
}

// ─── Preview (parse + annotate, no DB writes) ─────────────────────────────

export async function previewImport(
  csvContent: string,
  userId: string,
  accountId?: string | null
): Promise<ImportPreview> {
  const parseResult = CSVParser.parseCSV(csvContent);

  if (!parseResult.success || parseResult.transactions.length === 0) {
    return {
      transactions: [],
      totalRows: 0,
      duplicateCount: 0,
      transferCount: 0,
      headers: [],
      detectedMappings: {},
      errors: parseResult.errors,
    };
  }

  const preview = CSVParser.generatePreview(csvContent);

  const supabase = await createServerSupabaseClient();
  const { data: existingRows } = await (supabase as any)
    .from("books_transactions")
    .select("dedupe_fingerprint")
    .eq("user_id", userId)
    .not("dedupe_fingerprint", "is", null);

  const existingFingerprints = new Set<string>(
    (existingRows ?? []).map((r: { dedupe_fingerprint: string }) => r.dedupe_fingerprint)
  );

  const withDupes = annotateWithDuplicateFlags(parseResult.transactions, existingFingerprints, accountId);
  const withTransfers = annotateWithTransferFlags(withDupes);

  const annotated = await Promise.all(
    withDupes.map(async (tx, i) => {
      const fuzzyCandidate = accountId && !tx.isDuplicate
        ? await findPossibleDuplicateCandidate(supabase as any, userId, accountId, tx)
        : null;

      return {
        ...tx,
        possibleDuplicate: Boolean(fuzzyCandidate),
        duplicateConfidence: fuzzyCandidate?.confidence,
        duplicateCandidateId: fuzzyCandidate?.id,
        isTransfer: withTransfers[i].isTransfer,
        transferConfidence: withTransfers[i].transferConfidence,
      };
    })
  );

  return {
    transactions: annotated,
    totalRows: parseResult.transactions.length,
    duplicateCount: annotated.filter((t) => t.isDuplicate).length,
    transferCount: annotated.filter((t) => t.isTransfer).length,
    headers: preview.headers,
    detectedMappings: preview.detectedMappings,
    errors: parseResult.errors,
  };
}

// ─── Confirm import (DB writes) ────────────────────────────────────────────

export async function confirmImport(payload: ConfirmImportPayload): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthenticated");

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    duplicatesSkipped: 0,
    errors: [],
    batchId: payload.batchId,
  };

  const insertedRows: {
    id: string;
    description: string;
    merchant: string | null;
    amount: number;
    date: string;
    category_id: null;
    financial_account_id: string;
  }[] = [];

  for (const tx of payload.transactions) {
    if (tx.isDuplicate && !tx.overrideDuplicate) {
      result.duplicatesSkipped++;
      result.skipped++;
      continue;
    }

    const fuzzyCandidate = tx.possibleDuplicate && tx.duplicateCandidateId
      ? { id: tx.duplicateCandidateId, confidence: tx.duplicateConfidence ?? null }
      : await findPossibleDuplicateCandidate(supabase as any, user.id, payload.accountId, tx);

    const row = {
      id: randomUUID(),
      user_id: user.id,
      metadata: {
        tax_entity_id: payload.entityId,
        possible_duplicate: Boolean(fuzzyCandidate),
        duplicate_confidence: fuzzyCandidate?.confidence ?? undefined,
        duplicate_candidate_id: fuzzyCandidate?.id ?? undefined,
      },
      financial_account_id: payload.accountId,
      date: tx.date,
      description: tx.description,
      merchant: tx.merchant ?? null,
      amount: tx.amount,
      transaction_type: tx.type ?? (tx.amount < 0 ? "debit" : "credit"),
      is_transfer: tx.isTransfer,
      import_source: "csv",
      import_batch_id: payload.batchId,
      category_id: null,
      dedupe_fingerprint: tx.overrideDuplicate
        ? null
        : buildTransactionFingerprint({
            financialAccountId: payload.accountId,
            date: tx.date,
            amount: tx.amount,
            description: tx.description,
          }),
    };

    const { error } = await (supabase as any).from("books_transactions").insert(row);
    if (error) {
      if (isUniqueViolation(error)) {
        result.duplicatesSkipped++;
        result.skipped++;
        continue;
      }
      result.errors.push(error.message);
      continue;
    }

    result.imported++;
    insertedRows.push({
      id: row.id,
      description: row.description,
      merchant: row.merchant,
      amount: row.amount,
      date: row.date,
      category_id: row.category_id,
      financial_account_id: row.financial_account_id,
    });
  }

  if (insertedRows.length === 0) return result;

  const assignedCount = await autoAssignTaxEntities(supabase, user.id, insertedRows);
  console.log(`[import] Auto-assigned ${assignedCount} transactions to tax entities via rules`);

  return result;
}
