/**
 * Books module — shared TypeScript types
 * All DB types mirror the books_* tables in packages/db/migrations/002_books.sql
 */

// ─── Tax Entity (formerly UDA) ─────────────────────────────────────────────
// A Tax Entity represents a business, LLC, rental property, or other entity
// for tax reporting purposes. Financial accounts can be linked to Tax Entities.

export interface TaxEntity {
  id: string;
  user_id: string;
  name: string;
  entity_type: "llc" | "s_corp" | "c_corp" | "partnership" | "sole_proprietorship" | "rental_property";
  tax_id?: string | null;
  address?: Record<string, string> | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// DEPRECATED: BooksUda is being replaced by TaxEntity
// Keeping for backward compatibility during migration
export interface BooksUda {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at?: string;
}

// DEPRECATED: BooksEntity is being consolidated into TaxEntity
export interface BooksEntity {
  id: string;
  user_id: string;
  name: string;
  type: "individual" | "llc" | "s_corp" | "c_corp" | "partnership" | "sole_prop";
  tax_id?: string | null;
  fiscal_year_start?: number | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

// ─── Financial Account ─────────────────────────────────────────────────────
// An actual bank account, credit card, or other financial institution account.
// Can optionally be linked to a Tax Entity for grouping purposes.

export interface BooksAccount {
  id: string;
  uda_id?: string | null; // DEPRECATED: use tax_entity_id instead
  tax_entity_id?: string | null; // Links to TaxEntity
  user_id: string;
  name: string;
  institution?: string | null;
  institution_name?: string | null; // Alias for institution
  last_four_digits?: string | null;
  account_type: "checking" | "savings" | "credit_card" | "loan" | "investment" | "other";
  currency: string;
  current_balance?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  tax_entity?: TaxEntity | null;
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
  taxEntityId: string;
  taxEntityName: string;
  income: number;
  expenses: Record<string, number>; // categoryName -> total
  netIncome: number;
}

export interface ScheduleEReport {
  entityId: string;
  taxYear: number;
  properties: ScheduleEProperty[];
}
