import * as XLSX from "xlsx";

export interface WorkbookTargetCandidate {
  sheet_name: string;
  label: string;
  target_cell: string;
  target_range?: string | null;
  target_type: "currency_total";
  detected_confidence: number;
  is_formula_cell: boolean;
  is_writable: boolean;
  metadata: {
    label_cell: string;
    label_column: string;
    target_column: string;
  };
}

export interface WorkbookSheetSummary {
  name: string;
  range: string | null;
  target_count: number;
}

export interface WorkbookAnalysisResult {
  sheets: WorkbookSheetSummary[];
  targets: WorkbookTargetCandidate[];
}

export interface WorkbookFillTarget {
  sheet_name: string;
  target_cell: string;
  amount: number;
}

export interface WorkbookAuditRow {
  taxYear: number;
  taxEntity: string;
  cashpileCategory: string;
  workbookCategory: string;
  targetSheet: string;
  targetCell: string;
  transactionCount: number;
  grossAmount: number;
  exportedAmount: number;
  status: "mapped" | "ignored";
}

const MAX_SCAN_ROWS = 1_000;
const MAX_SCAN_COLS = 40;

function cellText(cell: XLSX.CellObject | undefined) {
  if (!cell) return "";
  const value = cell.v;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && cell.t === "s") return String(value).trim();
  return "";
}

function isLikelyLabel(value: string) {
  if (value.length < 2 || value.length > 80) return false;
  if (/^\d+([.,]\d+)?$/.test(value)) return false;
  if (/^(total|subtotal|balance|net income)$/i.test(value)) return false;
  return /[a-zA-Z]/.test(value);
}

function isWritableCandidate(cell: XLSX.CellObject | undefined) {
  if (!cell) return true;
  if (cell.f) return false;
  return cell.v === undefined || cell.v === null || typeof cell.v === "number";
}

function colName(index: number) {
  return XLSX.utils.encode_col(index);
}

export function analyzeTaxWorkbook(buffer: Buffer): WorkbookAnalysisResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true, cellDates: true });
  const targets: WorkbookTargetCandidate[] = [];
  const sheets: WorkbookSheetSummary[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const decoded = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    if (!decoded) {
      sheets.push({ name: sheetName, range: null, target_count: 0 });
      continue;
    }

    const beforeCount = targets.length;
    const maxRow = Math.min(decoded.e.r, decoded.s.r + MAX_SCAN_ROWS - 1);
    const maxCol = Math.min(decoded.e.c, decoded.s.c + MAX_SCAN_COLS - 1);
    const seen = new Set<string>();

    for (let row = decoded.s.r; row <= maxRow; row++) {
      for (let col = decoded.s.c; col <= maxCol; col++) {
        const labelCell = XLSX.utils.encode_cell({ r: row, c: col });
        const label = cellText(sheet[labelCell]);
        if (!isLikelyLabel(label)) continue;

        for (let offset = 1; offset <= 4 && col + offset <= maxCol; offset++) {
          const targetCell = XLSX.utils.encode_cell({ r: row, c: col + offset });
          const target = sheet[targetCell];
          if (!isWritableCandidate(target)) continue;

          const key = `${sheetName}!${targetCell}`;
          if (seen.has(key)) continue;
          seen.add(key);

          targets.push({
            sheet_name: sheetName,
            label,
            target_cell: targetCell,
            target_range: null,
            target_type: "currency_total",
            detected_confidence: target ? 0.7 : 0.55,
            is_formula_cell: Boolean(target?.f),
            is_writable: !target?.f,
            metadata: {
              label_cell: labelCell,
              label_column: colName(col),
              target_column: colName(col + offset),
            },
          });
          break;
        }
      }
    }

    sheets.push({
      name: sheetName,
      range: sheet["!ref"] ?? null,
      target_count: targets.length - beforeCount,
    });
  }

  return { sheets, targets };
}

export function fillTaxWorkbook(params: {
  templateBuffer: Buffer;
  fillTargets: WorkbookFillTarget[];
  auditRows: WorkbookAuditRow[];
}): Buffer {
  const workbook = XLSX.read(params.templateBuffer, { type: "buffer", cellFormula: true, cellDates: true });

  for (const target of params.fillTargets) {
    const sheet = workbook.Sheets[target.sheet_name];
    if (!sheet) throw new Error(`Workbook sheet not found: ${target.sheet_name}`);

    const existing = sheet[target.target_cell];
    if (existing?.f) throw new Error(`Refusing to overwrite formula cell ${target.sheet_name}!${target.target_cell}`);

    sheet[target.target_cell] = { t: "n", v: Number(target.amount.toFixed(2)) };
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : XLSX.utils.decode_range(target.target_cell);
    const cell = XLSX.utils.decode_cell(target.target_cell);
    range.s.r = Math.min(range.s.r, cell.r);
    range.s.c = Math.min(range.s.c, cell.c);
    range.e.r = Math.max(range.e.r, cell.r);
    range.e.c = Math.max(range.e.c, cell.c);
    sheet["!ref"] = XLSX.utils.encode_range(range);
  }

  const auditSheet = XLSX.utils.json_to_sheet(params.auditRows.map((row) => ({
    "Tax Year": row.taxYear,
    "Tax Entity": row.taxEntity,
    "Cashpile Category": row.cashpileCategory,
    "Workbook Category": row.workbookCategory,
    "Target Sheet": row.targetSheet,
    "Target Cell": row.targetCell,
    "Transaction Count": row.transactionCount,
    "Gross Amount": Number(row.grossAmount.toFixed(2)),
    "Exported Amount": Number(row.exportedAmount.toFixed(2)),
    Status: row.status,
  })));

  if (workbook.SheetNames.includes("Cashpile Export Audit")) {
    delete workbook.Sheets["Cashpile Export Audit"];
    workbook.SheetNames = workbook.SheetNames.filter((name) => name !== "Cashpile Export Audit");
  }
  XLSX.utils.book_append_sheet(workbook, auditSheet, "Cashpile Export Audit");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
