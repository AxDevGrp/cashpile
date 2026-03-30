"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { randomUUID } from "crypto";
import { CSVParser } from "../services/csv-parser";
import { previewImport, confirmImport } from "../services/transaction-import";
import type { ImportPreview, ImportResult } from "../types";

export async function parseFile(csvContent: string): Promise<{
  preview: ReturnType<typeof CSVParser.generatePreview>;
  errors: string[];
}> {
  const preview = CSVParser.generatePreview(csvContent);
  const parsed = CSVParser.parseCSV(csvContent);
  return { preview, errors: parsed.errors };
}

export async function getImportPreview(csvContent: string): Promise<ImportPreview> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return previewImport(csvContent, user.id);
}

export async function executeImport(
  csvContent: string,
  accountId: string,
  entityId: string,
  overrideDuplicates = false
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const preview = await previewImport(csvContent, user.id);
  const batchId = randomUUID();

  return confirmImport({
    accountId,
    entityId,
    batchId,
    transactions: preview.transactions.map((tx) => ({
      ...tx,
      overrideDuplicate: overrideDuplicates,
    })),
  });
}
