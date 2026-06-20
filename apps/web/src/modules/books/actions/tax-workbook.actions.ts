"use server";

import { createHash, randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import {
  analyzeTaxWorkbook,
  fillTaxWorkbook,
  type WorkbookAuditRow,
  type WorkbookFillTarget,
} from "../services/tax-workbook";
import type { TaxWorkbookTarget, TaxWorkbookTemplate } from "../types";

const BUCKET = "tax-workbooks";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export interface TaxMappingReviewRow {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  transactionCount: number;
  grossAmount: number;
  deductibleAmount: number;
  mapping: {
    id: string;
    targetId: string | null;
    targetLabel?: string;
    targetSheet?: string;
    targetCell?: string;
    isIgnored: boolean;
  } | null;
  status: "mapped" | "ignored" | "unmapped";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "workbook.xlsx";
}

function requireXlsx(file: File) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) {
    throw new Error("Only .xlsx workbooks are supported for tax templates.");
  }
}

async function getUser(supabase: Supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return user;
}

export async function uploadAndAnalyzeTaxWorkbook(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const user = await getUser(supabase);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Workbook file is required.");
  requireXlsx(file);

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  const templateId = randomUUID();
  const filename = sanitizeFileName(file.name);
  const storagePath = `${user.id}/templates/${templateId}/${filename}`;
  const name = String(formData.get("name") ?? file.name.replace(/\.xlsx$/i, "")).trim();
  const preparerName = String(formData.get("preparerName") ?? "").trim() || null;
  const taxYearValue = Number(formData.get("taxYear"));
  const taxYear = Number.isFinite(taxYearValue) ? taxYearValue : null;

  const analysis = analyzeTaxWorkbook(buffer);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: template, error: templateError } = await (supabase as any)
    .from("tax_workbook_templates")
    .insert({
      id: templateId,
      user_id: user.id,
      name: name || filename,
      tax_year: taxYear,
      preparer_name: preparerName,
      storage_path: storagePath,
      original_filename: file.name,
      file_hash: hash,
      status: "analyzed",
    })
    .select()
    .single();
  if (templateError) throw new Error(templateError.message);

  if (analysis.targets.length > 0) {
    const { error: targetsError } = await (supabase as any)
      .from("tax_workbook_targets")
      .insert(analysis.targets.map((target) => ({ ...target, template_id: templateId })));
    if (targetsError) throw new Error(targetsError.message);
  }

  revalidatePath("/books/tax");
  return {
    template: template as TaxWorkbookTemplate,
    sheets: analysis.sheets,
    targetCount: analysis.targets.length,
  };
}

export async function listTaxWorkbookTemplates() {
  const supabase = await createServerSupabaseClient();
  const user = await getUser(supabase);

  const { data, error } = await (supabase as any)
    .from("tax_workbook_templates")
    .select("*, tax_workbook_targets(count)")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listTaxWorkbookTargets(templateId: string): Promise<TaxWorkbookTarget[]> {
  const supabase = await createServerSupabaseClient();
  await getUser(supabase);

  const { data, error } = await (supabase as any)
    .from("tax_workbook_targets")
    .select("*")
    .eq("template_id", templateId)
    .eq("is_writable", true)
    .order("sheet_name")
    .order("label");
  if (error) throw new Error(error.message);
  return (data ?? []) as TaxWorkbookTarget[];
}

async function fetchCategoryTotals(params: {
  supabase: Supabase;
  userId: string;
  taxEntityId: string;
  year: number;
}) {
  const { data: views, error } = await (params.supabase as any)
    .from("books_tax_transaction_views")
    .select(`
      id,
      category_id,
      tax_amount,
      tax_date,
      business_percentage,
      deduction_percentage,
      is_tax_deductible,
      books_transactions(id, amount, date, is_transfer, category_id, transaction_type)
    `)
    .eq("user_id", params.userId)
    .eq("tax_entity_id", params.taxEntityId)
    .gte("tax_date", `${params.year}-01-01`)
    .lte("tax_date", `${params.year}-12-31`);
  if (error) throw new Error(error.message);

  const categoryIds = Array.from(new Set((views ?? [])
    .map((view: any) => view.category_id ?? view.books_transactions?.category_id)
    .filter((id: unknown) => id !== null && id !== undefined))) as number[];

  const categoryMap = new Map<number, { id: number; name: string; category_type: string }>();
  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await (params.supabase as any)
      .from("books_categories")
      .select("id, name, category_type")
      .eq("user_id", params.userId)
      .in("id", categoryIds);
    if (categoriesError) throw new Error(categoriesError.message);
    for (const category of categories ?? []) categoryMap.set(Number(category.id), category);
  }

  const totals = new Map<number, {
    categoryId: number;
    categoryName: string;
    categoryType: string;
    transactionCount: number;
    grossAmount: number;
    deductibleAmount: number;
  }>();

  for (const view of views ?? []) {
    const tx = Array.isArray(view.books_transactions) ? view.books_transactions[0] : view.books_transactions;
    if (!tx || tx.is_transfer) continue;

    const categoryId = Number(view.category_id ?? tx.category_id ?? 0);
    if (!categoryId) continue;

    const category = categoryMap.get(categoryId);
    const baseAmount = Math.abs(Number(view.tax_amount ?? tx.amount ?? 0));
    const businessPct = Number(view.business_percentage ?? 100);
    const deductionPct = Number(view.deduction_percentage ?? 100);
    const grossAmount = Math.abs(Number(tx.amount ?? baseAmount));
    const deductibleAmount = baseAmount * (businessPct / 100) * (deductionPct / 100);

    const current = totals.get(categoryId) ?? {
      categoryId,
      categoryName: category?.name ?? "Uncategorized",
      categoryType: category?.category_type ?? (tx.transaction_type === "credit" ? "income" : "expense"),
      transactionCount: 0,
      grossAmount: 0,
      deductibleAmount: 0,
    };
    current.transactionCount += 1;
    current.grossAmount += grossAmount;
    current.deductibleAmount += deductibleAmount;
    totals.set(categoryId, current);
  }

  return Array.from(totals.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

async function fetchMappings(params: {
  supabase: Supabase;
  userId: string;
  templateId: string;
  taxEntityId: string;
  categoryIds: number[];
}) {
  if (params.categoryIds.length === 0) return new Map<number, any>();

  const { data, error } = await (params.supabase as any)
    .from("tax_category_mappings")
    .select("*, tax_workbook_targets(label, sheet_name, target_cell)")
    .eq("user_id", params.userId)
    .eq("template_id", params.templateId)
    .eq("is_active", true)
    .in("cashpile_category_id", params.categoryIds)
    .or(`tax_entity_id.eq.${params.taxEntityId},tax_entity_id.is.null`);
  if (error) throw new Error(error.message);

  const map = new Map<number, any>();
  for (const mapping of data ?? []) {
    const existing = map.get(Number(mapping.cashpile_category_id));
    if (!existing || mapping.tax_entity_id === params.taxEntityId) {
      map.set(Number(mapping.cashpile_category_id), mapping);
    }
  }
  return map;
}

export async function getTaxWorkbookMappingReview(params: {
  templateId: string;
  taxEntityId: string;
  year: number;
}) {
  const supabase = await createServerSupabaseClient();
  const user = await getUser(supabase);

  const totals = await fetchCategoryTotals({
    supabase,
    userId: user.id,
    taxEntityId: params.taxEntityId,
    year: params.year,
  });
  const mappings = await fetchMappings({
    supabase,
    userId: user.id,
    templateId: params.templateId,
    taxEntityId: params.taxEntityId,
    categoryIds: totals.map((row) => row.categoryId),
  });

  const rows: TaxMappingReviewRow[] = totals.map((row) => {
    const mapping = mappings.get(row.categoryId);
    const target = Array.isArray(mapping?.tax_workbook_targets)
      ? mapping.tax_workbook_targets[0]
      : mapping?.tax_workbook_targets;
    const isIgnored = Boolean(mapping?.is_ignored);
    const isMapped = Boolean(mapping?.target_id);
    return {
      ...row,
      mapping: mapping ? {
        id: mapping.id,
        targetId: mapping.target_id,
        targetLabel: target?.label,
        targetSheet: target?.sheet_name,
        targetCell: target?.target_cell,
        isIgnored,
      } : null,
      status: isIgnored ? "ignored" : isMapped ? "mapped" : "unmapped",
    };
  });

  return {
    rows,
    mappedCount: rows.filter((row) => row.status === "mapped").length,
    ignoredCount: rows.filter((row) => row.status === "ignored").length,
    unmappedCount: rows.filter((row) => row.status === "unmapped" && row.deductibleAmount !== 0).length,
    canExport: rows.every((row) => row.deductibleAmount === 0 || row.status !== "unmapped"),
  };
}

export async function saveTaxCategoryMapping(input: {
  templateId: string;
  taxEntityId?: string | null;
  taxYear?: number | null;
  categoryId: number;
  categoryName: string;
  targetId?: string | null;
  isIgnored?: boolean;
  deductionPercentageOverride?: number | null;
}) {
  const supabase = await createServerSupabaseClient();
  const user = await getUser(supabase);

  if (!input.isIgnored && !input.targetId) {
    throw new Error("Choose a workbook target or mark this category ignored.");
  }

  let deactivateQuery = (supabase as any)
    .from("tax_category_mappings")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("cashpile_category_id", input.categoryId);
  deactivateQuery = input.taxEntityId
    ? deactivateQuery.eq("tax_entity_id", input.taxEntityId)
    : deactivateQuery.is("tax_entity_id", null);
  const { error: deactivateError } = await deactivateQuery;
  if (deactivateError) throw new Error(deactivateError.message);

  const { data, error } = await (supabase as any)
    .from("tax_category_mappings")
    .insert({
      user_id: user.id,
      template_id: input.templateId,
      tax_year: input.taxYear ?? null,
      tax_entity_id: input.taxEntityId ?? null,
      cashpile_category_id: input.categoryId,
      cashpile_category_name_snapshot: input.categoryName,
      target_id: input.isIgnored ? null : input.targetId,
      deduction_percentage_override: input.deductionPercentageOverride ?? null,
      is_ignored: Boolean(input.isIgnored),
      is_active: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await (supabase as any)
    .from("tax_workbook_templates")
    .update({ status: "mapped" })
    .eq("id", input.templateId)
    .eq("user_id", user.id);

  revalidatePath("/books/tax");
  return data;
}

export async function generateMappedTaxWorkbook(params: {
  templateId: string;
  taxEntityId: string;
  taxEntityName: string;
  year: number;
}) {
  const supabase = await createServerSupabaseClient();
  const user = await getUser(supabase);

  const review = await getTaxWorkbookMappingReview({
    templateId: params.templateId,
    taxEntityId: params.taxEntityId,
    year: params.year,
  });
  if (!review.canExport) {
    throw new Error(`${review.unmappedCount} nonzero categories must be mapped or ignored before export.`);
  }

  const { data: template, error: templateError } = await (supabase as any)
    .from("tax_workbook_templates")
    .select("*")
    .eq("id", params.templateId)
    .eq("user_id", user.id)
    .single();
  if (templateError) throw new Error(templateError.message);

  const { data: file, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(template.storage_path);
  if (downloadError) throw new Error(downloadError.message);
  const templateBuffer = Buffer.from(await file.arrayBuffer());

  const fillByCell = new Map<string, WorkbookFillTarget>();
  const auditRows: WorkbookAuditRow[] = [];

  for (const row of review.rows) {
    if (row.status === "ignored") {
      auditRows.push({
        taxYear: params.year,
        taxEntity: params.taxEntityName,
        cashpileCategory: row.categoryName,
        workbookCategory: "Ignored",
        targetSheet: "",
        targetCell: "",
        transactionCount: row.transactionCount,
        grossAmount: row.grossAmount,
        exportedAmount: 0,
        status: "ignored",
      });
      continue;
    }
    if (!row.mapping?.targetSheet || !row.mapping.targetCell) continue;

    const key = `${row.mapping.targetSheet}!${row.mapping.targetCell}`;
    const existing = fillByCell.get(key);
    const amount = row.deductibleAmount;
    fillByCell.set(key, {
      sheet_name: row.mapping.targetSheet,
      target_cell: row.mapping.targetCell,
      amount: (existing?.amount ?? 0) + amount,
    });
    auditRows.push({
      taxYear: params.year,
      taxEntity: params.taxEntityName,
      cashpileCategory: row.categoryName,
      workbookCategory: row.mapping.targetLabel ?? "",
      targetSheet: row.mapping.targetSheet,
      targetCell: row.mapping.targetCell,
      transactionCount: row.transactionCount,
      grossAmount: row.grossAmount,
      exportedAmount: amount,
      status: "mapped",
    });
  }

  const outputBuffer = fillTaxWorkbook({
    templateBuffer,
    fillTargets: Array.from(fillByCell.values()),
    auditRows,
  });

  const exportId = randomUUID();
  const outputPath = `${user.id}/exports/${exportId}/completed-tax-workbook-${params.year}.xlsx`;
  const { error: outputError } = await supabase.storage
    .from(BUCKET)
    .upload(outputPath, outputBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
  if (outputError) throw new Error(outputError.message);

  const summary = {
    mappedCategories: review.mappedCount,
    ignoredCategories: review.ignoredCount,
    targetCells: fillByCell.size,
    totalExported: auditRows.reduce((sum, row) => sum + row.exportedAmount, 0),
  };

  await (supabase as any)
    .from("tax_workbook_exports")
    .insert({
      id: exportId,
      user_id: user.id,
      template_id: params.templateId,
      tax_year: params.year,
      tax_entity_ids: [params.taxEntityId],
      status: "completed",
      output_storage_path: outputPath,
      summary,
      completed_at: new Date().toISOString(),
    });

  return {
    exportId,
    filename: `completed-tax-workbook-${params.taxEntityName}-${params.year}.xlsx`,
    buffer: outputBuffer,
    summary,
  };
}
