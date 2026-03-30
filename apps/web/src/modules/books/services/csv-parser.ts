/**
 * Books CSV Parser — adapted from stacks/src/lib/csv-parser.ts
 * Strips console.log noise; uses Books ImportedTransaction types.
 */

import type { ImportedTransaction, CSVParseResult, ImportError } from "../types";

const COLUMN_MAPPINGS = {
  description: [
    "description", "memo", "reference", "details", "transaction", "payee", "narrative",
    "transaction description", "memo field", "reference number", "transaction details",
    "desc", "note", "notes", "comment", "remarks", "transaction memo",
  ],
  amount: [
    "amount", "value", "debit", "credit", "total", "sum", "balance", "transaction amount",
    "debit amount", "credit amount", "net amount", "gross amount", "payment amount",
    "amt", "transaction value", "money", "cash", "payment", "withdrawal", "deposit",
  ],
  date: [
    "date", "transaction date", "posted date", "effective date", "value date", "booking date",
    "process date", "settlement date", "created date", "processed date", "entry date",
    "trans date", "txn date", "post date", "val date", "dt", "transaction dt",
  ],
  merchant: [
    "merchant", "payee", "vendor", "store", "business", "company", "seller", "retailer",
    "merchant name", "payee name", "vendor name", "store name", "business name",
    "counterparty", "recipient", "beneficiary", "supplier", "service provider",
  ],
  type: [
    "type", "transaction type", "kind", "category type", "payment type", "txn type",
    "transaction kind", "entry type", "operation type", "movement type", "activity type",
  ],
  category: [
    "category", "categories", "category name", "expense category", "budget category",
    "spending category", "transaction category", "classification", "group", "tag",
    "expense type", "income type", "budget group", "expense group", "cat", "class",
  ],
};

const NON_HEADER_PATTERNS = [
  /^transaction details/i,
  /^account summary/i,
  /^statement period/i,
  /^card.*\/.*to.*\//i,
  /^download date/i,
  /^report generated/i,
  /^\s*$/,
  /^[^,]*card[^,]*\s+\/\s+/i,
];

const AMOUNT_PATTERNS = {
  negative: /^\s*[-−]\s*|^\s*\(\s*.*\s*\)\s*$/,
  currency: /[$€£¥₹¢₽₩₪₨₡₵₦₨₴₱₸₾₴]/g,
  thousands: /,(?=\d{3})/g,
  europeanDecimal: /^(\d{1,3}(?:\.\d{3})*),(\d{2})$/,
  standardDecimal: /^(\d{1,3}(?:,\d{3})*)\.(\d{2})$/,
};

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^\d{2}-\d{2}-\d{4}$/,
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  /^\d{1,2}-\d{1,2}-\d{4}$/,
  /^\d{2}\/\d{2}\/\d{2}$/,
  /^\d{2}-\d{2}-\d{2}$/,
];

export class CSVParser {
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        if (nextChar === quoteChar) {
          current += char;
          i++;
        } else {
          inQuotes = false;
          quoteChar = "";
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private static normalizeColumnName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  }

  private static findColumnIndex(headers: string[], possibleNames: string[]): number {
    const normalizedHeaders = headers.map((h) => this.normalizeColumnName(h));

    for (const name of possibleNames) {
      const normalized = this.normalizeColumnName(name);
      const exact = normalizedHeaders.findIndex((h) => h === normalized);
      if (exact !== -1) return exact;
    }

    for (const name of possibleNames) {
      const normalized = this.normalizeColumnName(name);
      const contains = normalizedHeaders.findIndex((h) => h.includes(normalized));
      if (contains !== -1) return contains;

      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (normalized.includes(normalizedHeaders[i]) && normalizedHeaders[i].length > 2) {
          return i;
        }
      }
    }

    if (possibleNames.includes("category")) {
      const fallback = normalizedHeaders.findIndex(
        (h) => h.includes("cat") || h.includes("type") || h.includes("class")
      );
      if (fallback !== -1) return fallback;
    }

    return -1;
  }

  private static parseAmount(value: string): number | null {
    if (!value || typeof value !== "string") return null;

    let cleaned = value.trim();
    const isNegative = AMOUNT_PATTERNS.negative.test(cleaned);

    if (isNegative) {
      if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
        cleaned = cleaned.slice(1, -1).trim();
      } else {
        cleaned = cleaned.replace(/^[-−]\s*/, "").trim();
      }
    }

    cleaned = cleaned.replace(AMOUNT_PATTERNS.currency, "").trim();
    const numericAmount = this.parseNumericAmount(cleaned);
    if (numericAmount === null) return null;

    return isNegative ? -Math.abs(numericAmount) : numericAmount;
  }

  private static parseNumericAmount(value: string): number | null {
    if (!value) return null;

    const europeanMatch = value.match(AMOUNT_PATTERNS.europeanDecimal);
    if (europeanMatch) {
      const amount = parseFloat(`${europeanMatch[1].replace(/\./g, "")}.${europeanMatch[2]}`);
      return isNaN(amount) ? null : amount;
    }

    const standardMatch = value.match(AMOUNT_PATTERNS.standardDecimal);
    if (standardMatch) {
      const amount = parseFloat(`${standardMatch[1].replace(/,/g, "")}.${standardMatch[2]}`);
      return isNaN(amount) ? null : amount;
    }

    const amount = parseFloat(value.replace(AMOUNT_PATTERNS.thousands, ""));
    return isNaN(amount) ? null : amount;
  }

  private static parseDate(value: string): string | null {
    if (!value || typeof value !== "string") return null;

    const cleaned = value.trim();
    if (DATE_PATTERNS[0].test(cleaned)) return cleaned;

    let date: Date | null = null;

    if (DATE_PATTERNS[1].test(cleaned)) {
      const [m, d, y] = cleaned.split("/");
      date = new Date(+y, +m - 1, +d);
    } else if (DATE_PATTERNS[2].test(cleaned)) {
      const [m, d, y] = cleaned.split("-");
      date = new Date(+y, +m - 1, +d);
    } else if (DATE_PATTERNS[3].test(cleaned)) {
      const [m, d, y] = cleaned.split("/");
      date = new Date(+y, +m - 1, +d);
    } else if (DATE_PATTERNS[4].test(cleaned)) {
      const [m, d, y] = cleaned.split("-");
      date = new Date(+y, +m - 1, +d);
    } else if (DATE_PATTERNS[5].test(cleaned)) {
      const [m, d, y] = cleaned.split("/");
      const fy = +y < 50 ? 2000 + +y : 1900 + +y;
      date = new Date(fy, +m - 1, +d);
    } else if (DATE_PATTERNS[6].test(cleaned)) {
      const [m, d, y] = cleaned.split("-");
      const fy = +y < 50 ? 2000 + +y : 1900 + +y;
      date = new Date(fy, +m - 1, +d);
    } else {
      date = new Date(cleaned);
    }

    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  }

  private static detectColumnMappings(headers: string[]): Record<string, number> {
    const mappings: Record<string, number> = {};
    for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      const idx = this.findColumnIndex(headers, possibleNames);
      if (idx !== -1) mappings[field] = idx;
    }
    return mappings;
  }

  private static isNonHeaderRow(line: string): boolean {
    return NON_HEADER_PATTERNS.some((p) => p.test(line));
  }

  private static findHeaderRow(
    lines: string[]
  ): { headerIndex: number; headers: string[] } | null {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (!line || this.isNonHeaderRow(line)) continue;

      const headers = this.parseCSVLine(line);
      const mappings = this.detectColumnMappings(headers);
      const found = ["description", "amount", "date"].filter((f) => mappings[f] !== undefined);

      if (found.length >= 2) return { headerIndex: i, headers };
    }
    return null;
  }

  static parseCSV(csvContent: string): CSVParseResult {
    const result: CSVParseResult = { success: false, transactions: [], errors: [], skipped: 0 };

    if (!csvContent?.trim()) {
      result.errors.push("CSV content is empty");
      return result;
    }

    const lines = csvContent.trim().split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      result.errors.push("CSV must contain at least a header row and one data row");
      return result;
    }

    const headerResult = this.findHeaderRow(lines);
    if (!headerResult) {
      result.errors.push("Could not find a valid header row with recognizable column names");
      return result;
    }

    const { headerIndex, headers } = headerResult;
    const columnMappings = this.detectColumnMappings(headers);

    const missing = ["description", "amount", "date"].filter((f) => columnMappings[f] === undefined);
    if (missing.length > 0) {
      result.errors.push(`Missing required columns: ${missing.join(", ")}`);
      result.errors.push(`Available columns: ${headers.join(", ")}`);
      return result;
    }

    const transactions: ImportedTransaction[] = [];
    const errors: ImportError[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      try {
        const cols = this.parseCSVLine(lines[i]);
        const description = cols[columnMappings.description]?.trim();
        const amountStr = cols[columnMappings.amount]?.trim();
        const dateStr = cols[columnMappings.date]?.trim();

        const rowErrors: ImportError[] = [];
        if (!description) rowErrors.push({ row: i + 1, field: "description", message: "Description is required" });

        const amount = this.parseAmount(amountStr);
        if (amount === null) rowErrors.push({ row: i + 1, field: "amount", message: "Invalid amount", data: amountStr });

        const date = this.parseDate(dateStr);
        if (!date) rowErrors.push({ row: i + 1, field: "date", message: "Invalid date", data: dateStr });

        if (rowErrors.length > 0 || !description || amount === null || !date) {
          errors.push(...rowErrors);
          result.skipped++;
          continue;
        }

        const merchant = columnMappings.merchant !== undefined
          ? cols[columnMappings.merchant]?.trim() || undefined
          : undefined;

        const typeRaw = columnMappings.type !== undefined
          ? cols[columnMappings.type]?.trim()
          : undefined;
        const type: "debit" | "credit" | undefined =
          typeRaw === "debit" || typeRaw === "credit" ? typeRaw : undefined;

        const category = columnMappings.category !== undefined
          ? cols[columnMappings.category]?.trim() || undefined
          : undefined;

        transactions.push({ description, amount, date, merchant, type, category });
      } catch (err) {
        errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Unknown error", data: lines[i] });
        result.skipped++;
      }
    }

    result.transactions = transactions;
    result.success = transactions.length > 0;
    if (errors.length > 0) {
      result.errors = errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`);
    }
    return result;
  }

  static generatePreview(
    csvContent: string,
    maxRows = 5
  ): { headers: string[]; rows: string[][]; detectedMappings: Record<string, number>; totalRows: number } {
    const lines = csvContent.trim().split(/\r?\n/).filter((l) => l.trim());
    const headerResult = this.findHeaderRow(lines);

    if (!headerResult) {
      const headers = this.parseCSVLine(lines[0]);
      return {
        headers,
        rows: lines.slice(1, maxRows + 1).map((l) => this.parseCSVLine(l)),
        detectedMappings: this.detectColumnMappings(headers),
        totalRows: lines.length - 1,
      };
    }

    const { headerIndex, headers } = headerResult;
    const start = headerIndex + 1;
    return {
      headers,
      rows: lines.slice(start, start + maxRows).map((l) => this.parseCSVLine(l)),
      detectedMappings: this.detectColumnMappings(headers),
      totalRows: lines.length - start,
    };
  }
}
