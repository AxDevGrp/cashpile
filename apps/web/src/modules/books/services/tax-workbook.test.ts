import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { analyzeTaxWorkbook, fillTaxWorkbook } from "./tax-workbook.ts";

function sampleWorkbookBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Schedule C"],
    ["Meals", null],
    ["Software", null],
    ["Formula", null],
  ]);
  worksheet.B4 = { t: "n", f: "SUM(B2:B3)", v: 0 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule C");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("tax workbook analysis", () => {
  it("detects writable cells next to category labels without selecting formula cells", () => {
    const analysis = analyzeTaxWorkbook(sampleWorkbookBuffer());

    assert.equal(analysis.sheets[0].name, "Schedule C");
    assert.ok(analysis.targets.some((target) => target.label === "Meals" && target.target_cell === "B2"));
    assert.ok(analysis.targets.some((target) => target.label === "Software" && target.target_cell === "B3"));
    assert.ok(!analysis.targets.some((target) => target.label === "Formula" && target.target_cell === "B4"));
  });
});

describe("tax workbook filling", () => {
  it("writes mapped totals and appends an audit sheet", () => {
    const output = fillTaxWorkbook({
      templateBuffer: sampleWorkbookBuffer(),
      fillTargets: [{ sheet_name: "Schedule C", target_cell: "B2", amount: 123.456 }],
      auditRows: [{
        taxYear: 2025,
        taxEntity: "My LLC",
        cashpileCategory: "Meals & Dining",
        workbookCategory: "Meals",
        targetSheet: "Schedule C",
        targetCell: "B2",
        transactionCount: 3,
        grossAmount: 200,
        exportedAmount: 123.456,
        status: "mapped",
      }],
    });

    const workbook = XLSX.read(output, { type: "buffer" });
    assert.equal(workbook.Sheets["Schedule C"].B2.v, 123.46);
    assert.ok(workbook.SheetNames.includes("Cashpile Export Audit"));
  });

  it("refuses to overwrite formulas", () => {
    assert.throws(() => fillTaxWorkbook({
      templateBuffer: sampleWorkbookBuffer(),
      fillTargets: [{ sheet_name: "Schedule C", target_cell: "B4", amount: 10 }],
      auditRows: [],
    }), /Refusing to overwrite formula cell/);
  });
});
