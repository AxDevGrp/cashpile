/**
 * Books module — shared TypeScript types
 * All DB types mirror the books_* tables in packages/db/migrations/002_books.sql
 */

// ─── Database row types ────────────────────────────────────────────────────

export interface BooksEntity {
  id: string;
  user_id: string;
  name: string;
  type: "individual" | "llc" | "s_corp" | "c_corp" | "partnership" | "sole_prop";
  tax_id?: string | null;
  fiscal_year_start?: number | null; // 1-12
  default_currency: string;
  created_at: string;
  updated_at: string;
}

export interface BooksUda {
  id: string;
  entity_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface BooksAccount {
  id: string;
  uda_id: string;
  user_id: string;
  name: string;
  institution?: string | null;
  account_type: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BooksCategory {
  id: string;
  user_id: string;
  entity_id?: string | null;
  name: string;
  parent_id?: string | null;
  type: "income" | "expense" | "transfer";
  tax_category?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BooksTransaction {
  id: string;
  user_id: string;
  entity_id?: string | null;
  account_id: string;
  category_id?: string | null;
  date: string; // ISO YYYY-MM-DD
  description: string;
  merchant?: string | null;
  amount: number; // positive = credit, negative = debit
  currency: string;
  type: "debit" | "credit";
  is_transfer: boolean;
  transfer_pair_id?: string | null;
  import_source?: string | null;
  import_batch_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BooksDuplicateFingerprint {
  id: string;
  user_id: string;
  fingerprint: string;
  transaction_id: string;
  created_at: string;
}

// ─── Import flow types ─────────────────────────────────────────────────────

export interface ImportedTransaction {
  description: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  merchant?: string;
  type?: "debit" | "credit";
  category?: string;
}

export interface ImportError {
  row?: number;
  field?: string;
  message: string;
  data?: unknown;
}

export interface CSVParseResult {
  success: boolean;
  transactions: ImportedTransaction[];
  errors: string[];
  skipped: number;
}

export interface ImportPreview {
  transactions: (ImportedTransaction & {
    fingerprint: string;
    isDuplicate: boolean;
    isTransfer: boolean;
    transferConfidence?: number;
  })[];
  totalRows: number;
  duplicateCount: number;
  transferCount: number;
  headers: string[];
  detectedMappings: Record<string, number>;
  errors: string[];
}

export interface ConfirmImportPayload {
  accountId: string;
  entityId: string;
  transactions: (ImportedTransaction & {
    fingerprint: string;
    isDuplicate: boolean;
    isTransfer: boolean;
    overrideDuplicate?: boolean;
  })[];
  batchId: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicatesSkipped: number;
  errors: string[];
  batchId: string;
}

// ─── Report types ──────────────────────────────────────────────────────────

export interface PnLRow {
  categoryId: string;
  categoryName: string;
  type: "income" | "expense";
  total: number;
  monthlyBreakdown: Record<string, number>; // "YYYY-MM" -> amount
}

export interface PnLReport {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  rows: PnLRow[];
}

export interface CashFlowMonth {
  month: string; // "YYYY-MM"
  inflows: number;
  outflows: number;
  net: number;
}

export interface CashFlowReport {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  months: CashFlowMonth[];
}

export interface ScheduleEProperty {
  udaId: string;
  udaName: string;
  income: number;
  expenses: Record<string, number>; // categoryName -> total
  netIncome: number;
}

export interface ScheduleEReport {
  entityId: string;
  taxYear: number;
  properties: ScheduleEProperty[];
}
