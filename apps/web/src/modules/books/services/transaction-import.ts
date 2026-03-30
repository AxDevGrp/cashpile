/**
 * Transaction Import Orchestrator — Books module
 * Pipeline: parse → dedup check → transfer flag → bulk insert → fingerprint store
 * AI categorization is triggered async after insert (non-blocking).
 */

"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { randomUUID } from "crypto";
import { CSVParser } from "./csv-parser";
import { buildFingerprint, annotateWithDuplicateFlags } from "./duplicate-detection";
import { annotateWithTransferFlags } from "./transfer-detection";
import type { ConfirmImportPayload, ImportPreview, ImportResult } from "../types";

// ─── Preview (parse + annotate, no DB writes) ─────────────────────────────

export async function previewImport(
  csvContent: string,
  userId: string
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

  // Fetch existing fingerprints for this user
  const supabase = await createServerSupabaseClient();
  const { data: fpRows } = await supabase
    .from("books_duplicate_fingerprints")
    .select("fingerprint")
    .eq("user_id", userId);

  const existingFingerprints = new Set<string>((fpRows ?? []).map((r) => r.fingerprint));

  // Annotate duplicates then transfers
  const withDupes = annotateWithDuplicateFlags(parseResult.transactions, existingFingerprints);
  const withTransfers = annotateWithTransferFlags(withDupes);

  // Merge annotations back
  const annotated = withDupes.map((tx, i) => ({
    ...tx,
    isTransfer: withTransfers[i].isTransfer,
    transferConfidence: withTransfers[i].transferConfidence,
  }));

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

  const toInsert = payload.transactions.filter((tx) => {
    if (tx.isDuplicate && !tx.overrideDuplicate) {
      result.duplicatesSkipped++;
      return false;
    }
    return true;
  });

  if (toInsert.length === 0) return result;

  const rows = toInsert.map((tx) => ({
    id: randomUUID(),
    user_id: user.id,
    entity_id: payload.entityId,
    account_id: payload.accountId,
    date: tx.date,
    description: tx.description,
    merchant: tx.merchant ?? null,
    amount: tx.amount,
    currency: "USD",
    type: tx.type ?? (tx.amount < 0 ? "debit" : "credit"),
    is_transfer: tx.isTransfer,
    import_source: "csv",
    import_batch_id: payload.batchId,
    category_id: null, // async AI categorization after
  }));

  const { error } = await supabase.from("books_transactions").insert(rows);
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  result.imported = rows.length;

  // Store fingerprints to prevent future duplicates
  const fingerprintRows = toInsert.map((tx, i) => ({
    user_id: user.id,
    fingerprint: tx.fingerprint,
    transaction_id: rows[i].id,
  }));

  await supabase.from("books_duplicate_fingerprints").insert(fingerprintRows);

  return result;
}
